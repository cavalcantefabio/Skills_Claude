import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let flights: typeof import("@/server/flights/run");
let svc: typeof import("@/server/services/flight-alerts");
let userId: string;
let otherId: string;

type Resp = { content: unknown[]; stop_reason: string } | Error;
function fakeClient(responses: Resp[]) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      beta: {
        messages: {
          stream: (params: Record<string, unknown>) => {
            calls.push(structuredClone(params));
            const r = responses.shift();
            if (!r) throw new Error("sem resposta simulada");
            return {
              on: () => {},
              finalMessage: async () => {
                if (r instanceof Error) throw r;
                return {
                  id: "msg",
                  type: "message",
                  role: "assistant",
                  model: "claude-sonnet-5-5",
                  content: r.content,
                  stop_reason: r.stop_reason,
                  usage: { input_tokens: 1000, output_tokens: 500, server_tool_use: { web_search_requests: 4 } },
                };
              },
            };
          },
        },
      },
    },
  };
}

const voo = (over: Record<string, unknown> = {}) => ({
  origem_iata: "cgh",
  destino_iata: "AJU",
  tipo: "milhas",
  programa_slug: "smiles",
  programa_nome: "Smiles",
  companhia: "GOL",
  cabine: "economica",
  milhas: 30500,
  taxas_brl: 62,
  preco_brl: null,
  ida_e_volta: false,
  data_inicio: "2099-04-19",
  data_fim: "2099-04-19",
  assentos: 7,
  observacao: null,
  publicado_em: null,
  fonte_url: "https://pontospravoar.com/alerta-teste",
  fonte_nome: "Pontos pra Voar",
  ...over,
});

const register = (voos: unknown[]) => ({
  stop_reason: "tool_use",
  content: [{ type: "tool_use", id: "toolu_1", name: "registrar_voos", input: { resumo: "ok", voos } }],
});

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  flights = await import("@/server/flights/run");
  svc = await import("@/server/services/flight-alerts");
  const [u] = await db.insert(schema.users).values({ email: "voos@teste.dev", passwordHash: "x" }).returning();
  const [o] = await db.insert(schema.users).values({ email: "outro@teste.dev", passwordHash: "x" }).returning();
  userId = u.id;
  otherId = o.id;
  await db.insert(schema.profiles).values([{ userId, name: "V" }, { userId: otherId, name: "O" }]);
});

describe("busca de voos e avisos de rota", () => {
  it("grava voos válidos, descarta inválidos e registra disparos só dos avisos que batem", async () => {
    const [sp] = await db
      .insert(schema.routeAlerts)
      .values({ userId, originPlaces: [{ kind: "cidade", label: "São Paulo", codes: ["GRU", "CGH"] }], originCodes: ["GRU", "CGH"] })
      .returning();
    const [eu] = await db
      .insert(schema.routeAlerts)
      .values({ userId, destinationCodes: ["LIS", "MAD"], cabin: "executiva", pay: "milhas", maxMiles: 150000 })
      .returning();
    // Aviso de outra pessoa nunca recebe disparos destes voos.
    const [other] = await db.insert(schema.routeAlerts).values({ userId: otherId, originCodes: ["CGH"] }).returning();

    const { client, calls } = fakeClient([
      register([
        voo(),
        voo({ origem_iata: "GRU", destino_iata: "LIS", cabine: "executiva", milhas: 180000, ida_e_volta: true }), // ida e volta: 90 mil por trecho
        voo({ data_inicio: "2000-01-01", data_fim: "2000-01-02" }), // embarque passou
        voo({ publicado_em: "2000-01-01", destino_iata: "SSA" }), // alerta antigo
        voo({ destino_iata: "CGH" }), // origem = destino
        voo({ tipo: "dinheiro", preco_brl: null, milhas: null, destino_iata: "REC" }), // sem preço
      ]),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await flights.runFlightSearch({ client: client as any, userId, dailyLimit: 5 });
    expect(r.found).toBe(2);
    // CGH→AJU e GRU→LIS no aviso de São Paulo; GRU→LIS também no de Europa executiva
    // (180 mil ida e volta = 90 mil por trecho, abaixo do teto de 150 mil).
    expect(r.hits).toBe(3);

    const tools = calls[0].tools as { type?: string; name: string; allowed_domains?: string[] }[];
    expect(tools.map((t) => t.name)).toEqual(["web_search", "web_fetch", "registrar_voos"]);
    expect(tools[0].allowed_domains).toContain("pontospravoar.com");
    const userText = ((calls[0].messages as { content: { text: string }[] }[])[0].content[0].text);
    expect(userText).toMatch(/Avisos de rota da pessoa/);

    const deals = await db.select().from(schema.flightDeals).where(eq(schema.flightDeals.userId, userId));
    expect(deals.map((d) => `${d.origin}-${d.destination}`).sort()).toEqual(["CGH-AJU", "GRU-LIS"]);
    const hits = await db.select().from(schema.routeAlertHits);
    const byAlert = (id: string) => hits.filter((h) => h.alertId === id).length;
    expect(byAlert(sp.id)).toBe(2);
    expect(byAlert(eu.id)).toBe(1);
    expect(byAlert(other.id)).toBe(0);
    const [usage] = await db.select().from(schema.agentUsage).where(eq(schema.agentUsage.source, "voos"));
    expect(usage.webSearches).toBe(4);
  });

  it("não repete voos já encontrados e respeita o limite diário", async () => {
    const { client } = fakeClient([register([voo()])]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await flights.runFlightSearch({ client: client as any, userId, dailyLimit: 5 });
    expect(r.found).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(flights.runFlightSearch({ client: fakeClient([]).client as any, userId, dailyLimit: 2 })).rejects.toThrow(/Limite de 2/);
  });

  it("sem permissão para web_fetch, segue só com a busca", async () => {
    const refused = new Anthropic.BadRequestError(
      400,
      { type: "error", error: { type: "invalid_request_error", message: "not allowed to use tool web_fetch_20260209" } },
      undefined,
      new Headers(),
    );
    const { client, calls } = fakeClient([refused, register([voo({ destino_iata: "SSA" })])]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await flights.runFlightSearch({ client: client as any, userId, dailyLimit: 5 });
    expect(r.found).toBe(1);
    expect((calls[1].tools as { name: string }[]).map((t) => t.name)).toEqual(["web_search", "registrar_voos"]);
  });

  it("aviso novo pega voos já encontrados; disparos aparecem em Alertas até serem vistos", async () => {
    const [ssa] = await db.insert(schema.routeAlerts).values({ userId, destinationCodes: ["SSA"], dateMode: "mes", month: "2099-04" }).returning();
    expect(await svc.recordHits(userId, { alertIds: [ssa.id] })).toBe(1);
    expect(await svc.recordHits(userId, { alertIds: [ssa.id] })).toBe(0); // sem duplicar

    const { computeAlerts } = await import("@/server/services/alerts");
    const before = await computeAlerts(userId, 90);
    expect(before.filter((a) => a.id.startsWith("voo-")).length).toBeGreaterThan(0);
    expect(before.find((a) => a.id.startsWith("voo-"))!.title).toMatch(/Voo para o seu aviso: CGH \(São Paulo\) →/);
    expect(await svc.unseenHitCount(userId)).toBeGreaterThan(0);

    await svc.markHitsSeen(userId);
    expect(await svc.unseenHitCount(userId)).toBe(0);
    expect((await computeAlerts(userId, 90)).some((a) => a.id.startsWith("voo-"))).toBe(false);
    // Outra pessoa não vê nada.
    expect(await svc.listDeals(otherId)).toEqual([]);
  });

  it("aviso pausado não recebe disparos", async () => {
    const [paused] = await db.insert(schema.routeAlerts).values({ userId, originCodes: ["CGH"], active: false }).returning();
    expect(await svc.recordHits(userId, { alertIds: [paused.id] })).toBe(0);
  });
});

describe("buscas automáticas", () => {
  it("têm limite próprio, separado do botão", async () => {
    const [u] = await db.insert(schema.users).values({ email: "auto@teste.dev", passwordHash: "x" }).returning();
    await db.insert(schema.profiles).values({ userId: u.id, name: "A" });
    const ok = () => fakeClient([register([])]).client;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await flights.runFlightSearch({ client: ok() as any, userId: u.id, dailyLimit: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await flights.runFlightSearch({ client: ok() as any, userId: u.id, dailyLimit: 1, trigger: "automatica" });
    expect(await flights.flightRunsToday(u.id, "manual")).toBe(1);
    expect(await flights.flightRunsToday(u.id, "automatica")).toBe(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(flights.runFlightSearch({ client: ok() as any, userId: u.id, dailyLimit: 1, trigger: "automatica" })).rejects.toThrow(/automáticas/);
  });
});
