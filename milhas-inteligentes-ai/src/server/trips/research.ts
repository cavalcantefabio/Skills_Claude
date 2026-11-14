import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { FALLBACK_BETA, type AgentClient } from "@/server/agent/client";
import { RADAR_DOMAINS, RADAR_MODEL } from "@/server/radar/run";
import { listAccounts } from "@/server/services/accounts";
import { DomainError } from "@/server/services/errors";
import { CABIN_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { usageCost } from "@/lib/pricing";

/** Domínios para referências de viagem: os do Radar + sites oficiais de companhias. */
export const TRIP_RESEARCH_DOMAINS = [...RADAR_DOMAINS, "aa.com", "united.com", "delta.com", "copaair.com", "tap.pt", "flytap.com"].filter(
  (d, i, all) => all.indexOf(d) === i,
);

const MAX_SEARCHES = 6;
const MAX_ITERATIONS = 5;
const TOOL = "registrar_referencias";

const refSchema = z.object({
  resumo: z.string().max(800),
  referencias: z
    .array(
      z.object({
        tipo: z.enum(["milhas", "dinheiro"]),
        programa_slug: z.string().max(40).nullable().describe("Para milhas: slug de um dos programas listados."),
        site: z.string().max(80).nullable().describe("Para dinheiro: companhia ou site."),
        milhas_por_passageiro: z.number().int().positive().max(5_000_000).nullable(),
        taxas_por_passageiro_brl: z.number().nonnegative().max(100_000).nullable(),
        preco_por_passageiro_brl: z.number().positive().max(1_000_000).nullable(),
        cobre: z.enum(["ida_volta", "ida"]),
        fonte_url: z
          .string()
          .url()
          .max(500)
          .refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)."),
        fonte_nome: z.string().max(80).nullable(),
        observacao: z.string().max(300).nullable().describe("Período, data da publicação e condições da referência."),
      }),
    )
    .max(12),
});

type ResearchLog = { at: string; costUsd: number; found: number };

/** Pesquisas de referência feitas hoje pela pessoa (todas as viagens). */
export async function researchesToday(userId: string) {
  const rows = await db.select({ ai: schema.trips.aiContext }).from(schema.trips).where(eq(schema.trips.userId, userId));
  const today = todayISO();
  return rows.flatMap((r) => ((r.ai as { researches?: ResearchLog[] } | null)?.researches ?? []).filter((x) => x.at.slice(0, 10) === today)).length;
}

export async function researchTrip({ client, userId, tripId, dailyLimit }: { client: AgentClient; userId: string; tripId: string; dailyLimit: number }) {
  const [trip] = await db.select().from(schema.trips).where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, userId)));
  if (!trip) throw new DomainError("Viagem não encontrada.");
  if ((await researchesToday(userId)) >= dailyLimit) throw new DomainError(`Limite de ${dailyLimit} pesquisas de referência por dia atingido.`);

  const accounts = (await listAccounts(userId)).filter((a) => a.kind === "aerea" || a.kind === "hotel");
  const programs = accounts.map((a) => ({ slug: a.programSlug, name: a.programName, programId: a.programId }));
  const today = todayISO();

  const system = `Você pesquisa valores de REFERÊNCIA para uma viagem, usando a busca na web, e no fim chama ${TOOL} uma única vez.

Objetivo: para a rota e a classe informadas, encontrar (1) quantas milhas por passageiro costumam ser cobradas em cada programa listado e (2) o preço típico em dinheiro por passageiro, sempre com a página de onde tirou o número.

Regras:
- Os programas usam preço dinâmico; registre o valor que a fonte mostra (ex.: "a partir de" ou exemplos de emissões recentes) e explique em observacao o período e a data da publicação.
- Cada referência precisa de fonte_url com o número citado. Nunca invente valores, médias ou links. Se não encontrar uma fonte com número para um programa, não registre esse programa.
- Prefira fontes dos últimos 12 meses e a mesma rota (ou a mais próxima, dizendo qual em observacao).
- Use programa_slug apenas entre: ${programs.map((p) => `${p.slug} (${p.name})`).join(", ") || "nenhum programa aéreo cadastrado"}.
- Indique em cobre se o valor é por trecho ("ida") ou ida e volta ("ida_volta").
- Faça no máximo ${MAX_SEARCHES} buscas. Se nada útil aparecer, chame ${TOOL} com a lista vazia e explique no resumo.`;

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES, allowed_domains: TRIP_RESEARCH_DOMAINS },
    {
      name: TOOL,
      description: "Registra as referências encontradas (chame uma única vez, no final).",
      input_schema: (() => {
        const { $schema: _s, ...rest } = z.toJSONSchema(refSchema) as Record<string, unknown>;
        void _s;
        return { ...(rest as object), type: "object" } as Anthropic.Beta.BetaTool.InputSchema;
      })(),
      eager_input_streaming: true,
    },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Hoje é ${formatDate(today)}. Viagem: ${trip.origin} → ${trip.destination}, ${trip.tripType === "ida" ? "só ida" : "ida e volta"}, classe ${CABIN_LABEL[trip.cabin]}${
            trip.departDate ? `, ida por volta de ${formatDate(trip.departDate)}` : ""
          }${trip.flexDays ? ` (±${trip.flexDays} dias)` : ""}. Pesquise as referências.`,
        },
      ],
    },
  ];

  let costUsd = 0;
  let registered: z.infer<typeof refSchema> | null = null;
  for (let i = 0; i < MAX_ITERATIONS && !registered; i++) {
    const stream = client.beta.messages.stream({
      model: RADAR_MODEL,
      max_tokens: 32000,
      system,
      tools,
      messages,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIError) throw err;
      continue;
    }
    const cost = usageCost(message.usage ?? {}, message.model);
    costUsd += cost.usd;
    await db.insert(schema.agentUsage).values({
      userId,
      conversationId: null,
      model: message.model || RADAR_MODEL,
      inputTokens: cost.tokens.input,
      outputTokens: cost.tokens.output,
      cacheReadTokens: cost.tokens.cacheRead,
      cacheWriteTokens: cost.tokens.cacheWrite,
      webSearches: cost.webSearches,
      source: "viagem",
      costUsd: cost.usd.toFixed(6),
    });
    messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
    if (message.stop_reason === "refusal") throw new DomainError("O modelo não concluiu a pesquisa.");
    if (message.stop_reason === "pause_turn") continue;
    const call = message.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === TOOL);
    if (!call) {
      if (message.stop_reason === "end_turn") messages.push({ role: "user", content: [{ type: "text", text: `Agora chame ${TOOL} com o que encontrou.` }] });
      continue;
    }
    const parsed = refSchema.safeParse(call.input);
    if (!parsed.success || message.stop_reason === "max_tokens") {
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: call.id,
            is_error: true,
            content: parsed.success ? "Entrada cortada; envie de novo." : `Entrada inválida: ${JSON.stringify(z.flattenError(parsed.error))}`,
          },
        ],
      });
      continue;
    }
    registered = parsed.data;
  }
  if (!registered) throw new DomainError("A pesquisa terminou sem registrar resultados. Tente de novo mais tarde.");

  const bySlug = new Map(programs.map((p) => [p.slug, p.programId]));
  const rows = registered.referencias
    .filter((r) => (r.tipo === "milhas" ? r.programa_slug && bySlug.has(r.programa_slug) && r.milhas_por_passageiro : r.preco_por_passageiro_brl))
    .map((r) => ({
      tripId,
      userId,
      kind: r.tipo,
      certainty: "estimativa" as const,
      programId: r.tipo === "milhas" ? bySlug.get(r.programa_slug!)! : null,
      label: r.tipo === "dinheiro" ? (r.site ?? r.fonte_nome ?? "Referência") : null,
      milesPerPax: r.tipo === "milhas" ? r.milhas_por_passageiro : null,
      taxesPerPaxBrl: r.tipo === "milhas" && r.taxas_por_passageiro_brl != null ? r.taxas_por_passageiro_brl.toFixed(2) : null,
      cashPerPaxBrl: r.tipo === "dinheiro" ? r.preco_por_passageiro_brl!.toFixed(2) : null,
      covers: r.cobre,
      sourceUrl: r.fonte_url,
      checkedOn: today,
      notes: [r.fonte_nome, r.observacao].filter(Boolean).join(" · ").slice(0, 300) || null,
    }));
  if (rows.length) await db.insert(schema.tripQuotes).values(rows);

  const ai = (trip.aiContext as { researches?: ResearchLog[] } | null) ?? {};
  await db
    .update(schema.trips)
    .set({ aiContext: { ...ai, researches: [...(ai.researches ?? []).slice(-20), { at: new Date().toISOString(), costUsd, found: rows.length }], lastResearchSummary: registered.resumo } })
    .where(eq(schema.trips.id, tripId));
  return { found: rows.length, costUsd, summary: registered.resumo };
}
