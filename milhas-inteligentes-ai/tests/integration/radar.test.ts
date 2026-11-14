import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let radar: typeof import("@/server/radar/run");
let userId: string;

function fakeClient(responses: { content: unknown[]; stop_reason: string; usage?: Record<string, unknown> }[]) {
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
              finalMessage: async () => ({
                id: "msg",
                type: "message",
                role: "assistant",
                model: "claude-opus-5-5",
                content: r.content,
                stop_reason: r.stop_reason,
                usage: r.usage ?? { input_tokens: 1000, output_tokens: 500, server_tool_use: { web_search_requests: 3 } },
              }),
            };
          },
        },
      },
    },
  };
}

const promo = (over: Record<string, unknown> = {}) => ({
  tipo: "transferencia",
  titulo: "Livelo para Smiles com até 80% de bônus",
  origem_slug: "livelo",
  origem_nome: "Livelo",
  destino_slug: "smiles",
  destino_nome: "Smiles",
  bonus_pct: 80,
  paridade_origem: 1,
  paridade_destino: 1,
  desconto_pct: null,
  preco_milheiro_brl: null,
  inicio: "2026-11-10",
  fim: "2099-12-31",
  condicoes: "80% para clientes do clube.",
  fonte_url: "https://www.livelo.com.br/promocao",
  fonte_nome: "Livelo",
  ...over,
});

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  radar = await import("@/server/radar/run");
  const [u] = await db.insert(schema.users).values({ email: "radar@teste.dev", passwordHash: "x" }).returning();
  userId = u.id;
  await db.insert(schema.profiles).values({ userId, name: "R" });
});

describe("runRadar", () => {
  it("pesquisa com busca restrita a domínios, grava promoções vigentes e o custo", async () => {
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "registrar_promocoes",
            input: {
              resumo: "Uma promoção vigente.",
              promocoes: [
                promo(),
                promo({ titulo: "Encerrada", fim: "2020-01-01" }),
                promo({ titulo: "Slug estranho", origem_slug: "nao-existe" }),
              ],
            },
          },
        ],
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await radar.runRadar({ client: client as any, userId, dailyLimit: 5 });
    expect(r.found).toBe(2);
    expect(calls[0].model).toBe("claude-sonnet-5-5");
    expect(calls[0].fallbacks).toBe("default");
    const tools = calls[0].tools as { type?: string; name: string; allowed_domains?: string[] }[];
    const web = tools.find((t) => t.name === "web_search")!;
    expect(web.type).toBe("web_search_20260209");
    expect(web.allowed_domains).toContain("livelo.com.br");

    const opps = await db.select().from(schema.radarOpportunities).where(eq(schema.radarOpportunities.runId, r.runId));
    expect(opps.map((o) => o.title).sort()).toEqual(["Livelo para Smiles com até 80% de bônus", "Slug estranho"]);
    expect(opps.find((o) => o.title === "Slug estranho")!.fromSlug).toBeNull();

    const [run] = await db.select().from(schema.radarRuns).where(eq(schema.radarRuns.id, r.runId));
    expect(run.status).toBe("concluida");
    expect(run.webSearches).toBe(3);
    // 3 buscas × US$ 0,01 + 1.000 × 4/M + 500 × 20/M = 0,03 + 0,004 + 0,01
    expect(Number(run.costUsd)).toBeCloseTo(0.044, 6);
    const usage = await db.select().from(schema.agentUsage).where(eq(schema.agentUsage.userId, userId));
    expect(usage[0].source).toBe("radar");
  });

  it("recusa link que não é http(s) e pede o registro de novo", async () => {
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "toolu_bad", name: "registrar_promocoes", input: { resumo: "x", promocoes: [promo({ fonte_url: "javascript:alert(1)" })] } }],
      },
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "toolu_ok", name: "registrar_promocoes", input: { resumo: "ok", promocoes: [] } }],
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await radar.runRadar({ client: client as any, userId, dailyLimit: 5 });
    expect(r.found).toBe(0);
    const second = calls[1].messages as { role: string; content: { type: string; is_error?: boolean }[] }[];
    expect(second[second.length - 1].content[0]).toMatchObject({ type: "tool_result", is_error: true });
  });

  it("respeita o limite diário e marca a atualização como falha quando não há registro", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(radar.runRadar({ client: fakeClient([]).client as any, userId, dailyLimit: 2 })).rejects.toThrow(/Limite de 2/);

    const { client } = fakeClient(Array.from({ length: 6 }, () => ({ stop_reason: "end_turn", content: [{ type: "text", text: "sem registro" }] })));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(radar.runRadar({ client: client as any, userId, dailyLimit: 10 })).rejects.toThrow(/sem registrar/);
    const latest = await radar.latestRadar(userId);
    expect(latest!.run.summary).toBe("ok"); // a última concluída continua sendo a anterior
  });
});
