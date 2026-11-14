import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { AGENT_MODEL, FALLBACK_BETA, type AgentClient } from "@/server/agent/client";
import { listAccounts } from "@/server/services/accounts";
import { DomainError } from "@/server/services/errors";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { usageCost } from "@/lib/pricing";

/** Sites oficiais dos programas e blogs de milhas conhecidos (busca restrita a eles). */
export const RADAR_DOMAINS = [
  "livelo.com.br",
  "esfera.com.vc",
  "smiles.com.br",
  "latampass.latam.com",
  "latam.com",
  "voeazul.com.br",
  "tudoazul.com",
  "c6bank.com.br",
  "bancointer.com.br",
  "flytap.com",
  "flyingblue.com",
  "aa.com",
  "iberia.com",
  "all.accor.com",
  "passageirodeprimeira.com",
  "melhoresdestinos.com.br",
  "pontospravoar.com",
  "mestredasmilhas.com",
];

const MAX_SEARCHES = 8;
const MAX_ITERATIONS = 6;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const opportunitySchema = z.object({
  tipo: z.enum(["transferencia", "compra", "outra"]),
  titulo: z.string().min(3).max(160),
  origem_slug: z.string().max(40).nullable().describe("Slug do catálogo do programa de origem, ou null."),
  origem_nome: z.string().max(80).nullable(),
  destino_slug: z.string().max(40).nullable().describe("Slug do catálogo do programa de destino, ou null."),
  destino_nome: z.string().max(80).nullable(),
  bonus_pct: z.number().min(0).max(1000).nullable().describe("Bônus percentual (transferência ou compra)."),
  paridade_origem: z.number().positive().max(10000).nullable().describe("Ex.: em 2:1, 2."),
  paridade_destino: z.number().positive().max(10000).nullable().describe("Ex.: em 2:1, 1."),
  desconto_pct: z.number().min(0).max(100).nullable().describe("Desconto na compra de pontos."),
  preco_milheiro_brl: z
    .number()
    .positive()
    .max(10000)
    .nullable()
    .describe("Compra: preço pago por 1.000 pontos já com desconto, antes do bônus."),
  inicio: isoDate.nullable(),
  fim: isoDate.nullable().describe("Último dia da promoção, se informado na fonte."),
  condicoes: z.string().max(600).nullable().describe("Regras relevantes: clube exigido, limites, faixas de bônus."),
  fonte_url: z
    .string()
    .url()
    .max(500)
    .refine((u) => /^https?:\/\//i.test(u), "Use um link http(s)."),
  fonte_nome: z.string().max(80).nullable(),
});
const registerSchema = z.object({
  resumo: z.string().max(800).describe("Resumo em 1 a 3 frases do que foi encontrado."),
  promocoes: z.array(opportunitySchema).max(30),
});
export type RadarRegister = z.infer<typeof registerSchema>;

const REGISTER_TOOL = "registrar_promocoes";

function radarSystemPrompt(catalog: { slug: string; name: string }[]) {
  return `Você é o Radar de Oportunidades da plataforma Milhas Inteligentes AI, para uma pessoa no Brasil.

Tarefa: usar a busca na web para encontrar promoções de programas de fidelidade que estejam VIGENTES hoje e então chamar a ferramenta ${REGISTER_TOOL} uma única vez com tudo o que encontrou.

Procure principalmente:
- Transferências bonificadas entre programas de banco (Livelo, Esfera, Átomos, Inter Loop) e companhias aéreas ou hotéis (Smiles, LATAM Pass, Azul Fidelidade, TAP, etc.).
- Compra de pontos ou milhas com desconto ou bônus.

Regras:
- Registre apenas promoções cuja vigência inclui a data de hoje, confirmada na fonte. Se a fonte não deixa claro que ainda vale, não registre.
- Cada promoção precisa de fonte_url apontando para a página onde a informação aparece. Nunca invente números, datas ou links.
- Prefira a página oficial do programa; um blog serve como fonte quando trouxer as condições.
- Use origem_slug e destino_slug apenas com estes slugs do catálogo (ou null se não corresponder): ${catalog.map((c) => `${c.slug} (${c.name})`).join(", ")}.
- Bônus que dependem de clube ou categoria: use o bônus máximo em bonus_pct e explique as faixas em condicoes.
- Se não encontrar nada vigente, chame ${REGISTER_TOOL} com a lista vazia e explique no resumo.
- Faça no máximo ${MAX_SEARCHES} buscas.`;
}

/** Atualizações já feitas hoje (limite diário de custo). */
export async function radarRunsToday(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.radarRuns)
    .where(
      and(
        eq(schema.radarRuns.userId, userId),
        gte(schema.radarRuns.startedAt, sql`date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'`),
      ),
    );
  return r?.n ?? 0;
}

export async function runRadar({
  client,
  userId,
  dailyLimit,
}: {
  client: AgentClient;
  userId: string;
  dailyLimit: number;
}) {
  // Uma atualização por vez por pessoa (as antigas presas há mais de 10 min não bloqueiam).
  const [running] = await db
    .select({ id: schema.radarRuns.id })
    .from(schema.radarRuns)
    .where(
      and(
        eq(schema.radarRuns.userId, userId),
        eq(schema.radarRuns.status, "executando"),
        gte(schema.radarRuns.startedAt, sql`now() - interval '10 minutes'`),
      ),
    );
  if (running) throw new DomainError("Já existe uma atualização do radar em andamento.");
  if ((await radarRunsToday(userId)) >= dailyLimit) {
    throw new DomainError(`Limite de ${dailyLimit} atualizações do radar por dia atingido.`);
  }

  const [run] = await db.insert(schema.radarRuns).values({ userId }).returning();
  const catalog = await db.select({ slug: schema.programs.slug, name: schema.programs.name }).from(schema.programs).where(sql`${schema.programs.ownerUserId} is null`);
  const accounts = await listAccounts(userId);
  const today = todayISO();

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    { type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES, allowed_domains: RADAR_DOMAINS },
    {
      name: REGISTER_TOOL,
      description: "Registra as promoções vigentes encontradas (chame uma única vez, no final).",
      input_schema: (() => {
        const { $schema: _s, ...rest } = z.toJSONSchema(registerSchema) as Record<string, unknown>;
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
          text: `Hoje é ${formatDate(today)} (${today}). Programas que a pessoa usa: ${
            accounts.map((a) => a.programName).join(", ") || "nenhum cadastrado"
          }. Encontre as promoções vigentes, dando prioridade às que envolvem esses programas.`,
        },
      ],
    },
  ];

  let totalUsd = 0;
  let totalSearches = 0;
  let registered: RadarRegister | null = null;
  try {
    for (let i = 0; i < MAX_ITERATIONS && !registered; i++) {
      const stream = client.beta.messages.stream({
        model: AGENT_MODEL,
        max_tokens: 32000,
        system: radarSystemPrompt(catalog),
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
        continue; // entrada da ferramenta ilegível: tenta de novo
      }

      const cost = usageCost(message.usage ?? {}, message.model);
      totalUsd += cost.usd;
      totalSearches += cost.webSearches;
      await db.insert(schema.agentUsage).values({
        userId,
        conversationId: null,
        model: message.model || AGENT_MODEL,
        inputTokens: cost.tokens.input,
        outputTokens: cost.tokens.output,
        cacheReadTokens: cost.tokens.cacheRead,
        cacheWriteTokens: cost.tokens.cacheWrite,
        webSearches: cost.webSearches,
        source: "radar",
        costUsd: cost.usd.toFixed(6),
      });

      messages.push({ role: "assistant", content: message.content as Anthropic.Beta.BetaContentBlockParam[] });
      if (message.stop_reason === "refusal") throw new DomainError("O modelo não concluiu a pesquisa (recusa).");
      if (message.stop_reason === "pause_turn") continue;

      const call = message.content.find(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === REGISTER_TOOL,
      );
      if (!call) {
        if (message.stop_reason === "end_turn") {
          messages.push({ role: "user", content: [{ type: "text", text: `Agora chame ${REGISTER_TOOL} com o que encontrou.` }] });
        }
        continue;
      }
      const parsed = registerSchema.safeParse(call.input);
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

    const knownSlugs = new Set(catalog.map((c) => c.slug));
    const slug = (s: string | null) => (s && knownSlugs.has(s) ? s : null);
    // Descarta promoções já encerradas, mesmo que a fonte tenha sido citada.
    const current = registered.promocoes.filter((p) => !p.fim || p.fim >= today);
    if (current.length) {
      await db.insert(schema.radarOpportunities).values(
        current.map((p) => ({
          runId: run.id,
          userId,
          kind: p.tipo,
          title: p.titulo,
          fromSlug: slug(p.origem_slug),
          fromName: p.origem_nome,
          toSlug: slug(p.destino_slug),
          toName: p.destino_nome,
          bonusPct: p.bonus_pct?.toString() ?? null,
          ratioFrom: p.paridade_origem?.toString() ?? null,
          ratioTo: p.paridade_destino?.toString() ?? null,
          discountPct: p.desconto_pct?.toString() ?? null,
          pricePerThousandBrl: p.preco_milheiro_brl?.toFixed(2) ?? null,
          startsOn: p.inicio,
          endsOn: p.fim,
          conditions: p.condicoes,
          sourceUrl: p.fonte_url,
          sourceName: p.fonte_nome,
        })),
      );
    }
    await db
      .update(schema.radarRuns)
      .set({ status: "concluida", summary: registered.resumo, webSearches: totalSearches, costUsd: totalUsd.toFixed(6), finishedAt: new Date() })
      .where(eq(schema.radarRuns.id, run.id));
    return { runId: run.id, found: current.length, costUsd: totalUsd };
  } catch (err) {
    const message = err instanceof DomainError ? err.message : "Falha ao pesquisar promoções.";
    await db
      .update(schema.radarRuns)
      .set({ status: "falhou", error: message, webSearches: totalSearches, costUsd: totalUsd.toFixed(6), finishedAt: new Date() })
      .where(eq(schema.radarRuns.id, run.id));
    throw err;
  }
}

/** Última atualização concluída e suas promoções. */
export async function latestRadar(userId: string) {
  const [last] = await db
    .select()
    .from(schema.radarRuns)
    .where(and(eq(schema.radarRuns.userId, userId), eq(schema.radarRuns.status, "concluida")))
    .orderBy(desc(schema.radarRuns.startedAt))
    .limit(1);
  if (!last) return null;
  const opportunities = await db.select().from(schema.radarOpportunities).where(eq(schema.radarOpportunities.runId, last.id));
  return { run: last, opportunities };
}
