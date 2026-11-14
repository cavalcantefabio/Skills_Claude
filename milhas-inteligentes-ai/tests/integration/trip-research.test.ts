import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let research: typeof import("@/server/trips/research");
let userId: string;
let tripId: string;

function fake(responses: { content: unknown[]; stop_reason: string }[]) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      beta: {
        messages: {
          stream: (params: Record<string, unknown>) => {
            calls.push(structuredClone(params));
            const r = responses.shift()!;
            return {
              on: () => {},
              finalMessage: async () => ({ id: "m", type: "message", role: "assistant", model: "claude-sonnet-5-5", content: r.content, stop_reason: r.stop_reason, usage: { input_tokens: 10_000, output_tokens: 1000, server_tool_use: { web_search_requests: 4 } } }),
            };
          },
        },
      },
    },
  };
}

const ref = (o: Record<string, unknown>) => ({
  tipo: "milhas",
  programa_slug: "smiles",
  site: null,
  milhas_por_passageiro: 45_000,
  taxas_por_passageiro_brl: 320,
  preco_por_passageiro_brl: null,
  cobre: "ida",
  fonte_url: "https://www.melhoresdestinos.com.br/exemplo",
  fonte_nome: "Melhores Destinos",
  observacao: "Emissões vistas em out/2026",
  ...o,
});

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  research = await import("@/server/trips/research");
  const [u] = await db.insert(schema.users).values({ email: "pesq@teste.dev", passwordHash: "x" }).returning();
  userId = u.id;
  const [smiles] = await db.select().from(schema.programs).where(eq(schema.programs.slug, "smiles"));
  await db.insert(schema.loyaltyAccounts).values({ userId, programId: smiles.id });
  const [t] = await db.insert(schema.trips).values({ userId, title: "Orlando", origin: "GRU", destination: "MCO", passengers: 4 }).returning();
  tripId = t.id;
});

describe("pesquisa de referências de viagem", () => {
  it("salva só referências com fonte, como estimativa, e registra o custo", async () => {
    const { client, calls } = fake([
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t1",
            name: "registrar_referencias",
            input: {
              resumo: "Referências encontradas.",
              referencias: [
                ref({}),
                ref({ programa_slug: "latam-pass" }), // a pessoa não tem LATAM Pass: ignorado
                ref({ tipo: "dinheiro", programa_slug: null, milhas_por_passageiro: null, preco_por_passageiro_brl: 4200, site: "Companhia", cobre: "ida_volta" }),
              ],
            },
          },
        ],
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await research.researchTrip({ client: client as any, userId, tripId, dailyLimit: 5 });
    expect(r.found).toBe(2);
    expect(calls[0].model).toBe("claude-sonnet-5-5");
    const web = (calls[0].tools as { name: string; allowed_domains?: string[] }[]).find((t) => t.name === "web_search")!;
    expect(web.allowed_domains).toContain("smiles.com.br");
    const quotes = await db.select().from(schema.tripQuotes).where(eq(schema.tripQuotes.tripId, tripId));
    expect(quotes.every((q) => q.certainty === "estimativa" && q.sourceUrl?.startsWith("https://"))).toBe(true);
    expect(quotes.find((q) => q.kind === "milhas")!.covers).toBe("ida");
    const usage = await db.select().from(schema.agentUsage).where(eq(schema.agentUsage.source, "viagem"));
    // 4 buscas × 0,01 + 10.000 × 2/M + 1.000 × 10/M = 0,04 + 0,02 + 0,01
    expect(Number(usage[0].costUsd)).toBeCloseTo(0.07, 6);
  });

  it("recusa fonte que não é http(s) e respeita o limite diário", async () => {
    const { client } = fake([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "registrar_referencias", input: { resumo: "x", referencias: [ref({ fonte_url: "javascript:alert(1)" })] } }] },
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t3", name: "registrar_referencias", input: { resumo: "nada", referencias: [] } }] },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await research.researchTrip({ client: client as any, userId, tripId, dailyLimit: 5 });
    expect(r.found).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(research.researchTrip({ client: fake([]).client as any, userId, tripId, dailyLimit: 2 })).rejects.toThrow(/Limite de 2/);
  });
});
