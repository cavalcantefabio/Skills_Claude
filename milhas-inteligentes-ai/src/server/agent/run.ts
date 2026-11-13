import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { AGENT_MODEL, FALLBACK_BETA, type AgentClient } from "./client";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOL_LABELS, executeTool, toolDefinitions } from "./tools";
import { formatDate } from "@/lib/format";
import { todayISO } from "@/lib/dates";

type BetaMessageParam = Anthropic.Beta.BetaMessageParam;
type BetaContentBlock = Anthropic.Beta.BetaContentBlock;

/** Eventos enviados ao navegador durante um turno. */
export type AgentEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_end"; id: string; ok: boolean; actionId?: string }
  | { type: "action"; action: { id: string; toolUseId: string; kind: string; summary: string; status: string } }
  | { type: "notice"; tone: "warning" | "error"; message: string }
  | { type: "done" };

const MAX_ITERATIONS = 10;
const MAX_JSON_RETRIES = 2;

async function nextSeq(conversationId: string) {
  const [r] = await db
    .select({ n: sql<number>`coalesce(max(${schema.agentMessages.seq}), 0)::int` })
    .from(schema.agentMessages)
    .where(eq(schema.agentMessages.conversationId, conversationId));
  return (r?.n ?? 0) + 1;
}

async function append(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: unknown,
  extra: { usage?: unknown; stopReason?: string | null } = {},
) {
  await db.insert(schema.agentMessages).values({
    conversationId,
    seq: await nextSeq(conversationId),
    role,
    content,
    usage: extra.usage ?? null,
    stopReason: extra.stopReason ?? null,
  });
}

/** Histórico na forma exata da API (só acréscimo, nunca reescrito). */
export async function loadHistory(conversationId: string): Promise<BetaMessageParam[]> {
  const rows = await db
    .select({ role: schema.agentMessages.role, content: schema.agentMessages.content })
    .from(schema.agentMessages)
    .where(eq(schema.agentMessages.conversationId, conversationId))
    .orderBy(asc(schema.agentMessages.seq));
  return rows.map((r) => ({ role: r.role, content: r.content }) as BetaMessageParam);
}

/**
 * Contexto do turno como mensagem de sistema no meio da conversa: não invalida o
 * cache do prompt de sistema e é o canal do operador (não do usuário).
 */
async function turnContext(userId: string, conversationId: string) {
  const decided = await db
    .select()
    .from(schema.agentActions)
    .where(
      and(
        eq(schema.agentActions.conversationId, conversationId),
        eq(schema.agentActions.userId, userId),
        eq(schema.agentActions.reportedToAgent, false),
        sql`${schema.agentActions.status} <> 'pendente'`,
      ),
    );
  if (decided.length) {
    await db
      .update(schema.agentActions)
      .set({ reportedToAgent: true })
      .where(sql`${schema.agentActions.id} in ${decided.map((d) => d.id)}`);
  }
  const lines = [`Hoje é ${formatDate(todayISO())} (${todayISO()}, horário de Brasília).`];
  for (const d of decided) {
    lines.push(`Proposta "${d.summary}": ${d.status}${d.resultMessage ? ` (${d.resultMessage})` : ""}.`);
  }
  return lines.join("\n");
}

export async function createConversation(userId: string, firstMessage: string) {
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 60) || "Nova conversa";
  const [c] = await db
    .insert(schema.agentConversations)
    .values({ userId, title })
    .returning({ id: schema.agentConversations.id, title: schema.agentConversations.title });
  return c;
}

export async function ownsConversation(userId: string, conversationId: string) {
  const [c] = await db
    .select({ id: schema.agentConversations.id })
    .from(schema.agentConversations)
    .where(and(eq(schema.agentConversations.id, conversationId), eq(schema.agentConversations.userId, userId)));
  return Boolean(c);
}

/** Mensagens de texto enviadas pelo usuário hoje (limite diário de custo). */
export async function messagesToday(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.agentMessages)
    .innerJoin(schema.agentConversations, eq(schema.agentConversations.id, schema.agentMessages.conversationId))
    .where(
      and(
        eq(schema.agentConversations.userId, userId),
        eq(schema.agentMessages.role, "user"),
        sql`${schema.agentMessages.content}->0->>'type' = 'text'`,
        sql`${schema.agentMessages.createdAt} >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'`,
      ),
    );
  return r?.n ?? 0;
}

/** Guarda um aviso na última mensagem de texto do usuário (fica visível ao recarregar a conversa). */
export async function saveNotice(conversationId: string, notice: { tone: "warning" | "error"; message: string }) {
  const [last] = await db
    .select({ id: schema.agentMessages.id })
    .from(schema.agentMessages)
    .where(and(eq(schema.agentMessages.conversationId, conversationId), sql`${schema.agentMessages.content}->0->>'type' = 'text'`, eq(schema.agentMessages.role, "user")))
    .orderBy(sql`${schema.agentMessages.seq} desc`)
    .limit(1);
  if (last) await db.update(schema.agentMessages).set({ notice }).where(eq(schema.agentMessages.id, last.id));
}

export type RunTurnInput = {
  client: AgentClient;
  userId: string;
  alertDays: number;
  conversationId: string;
  text: string;
  emit: (e: AgentEvent) => void;
  signal?: AbortSignal;
};

export async function runAgentTurn({ client, userId, alertDays, conversationId, text, emit: rawEmit, signal }: RunTurnInput) {
  const emit = (e: AgentEvent) => {
    rawEmit(e);
    if (e.type === "notice") void saveNotice(conversationId, { tone: e.tone, message: e.message });
  };
  await append(conversationId, "user", [{ type: "text", text }]);
  await append(conversationId, "system", [{ type: "text", text: await turnContext(userId, conversationId) }]);

  let jsonRetries = 0;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const messages = await loadHistory(conversationId);
    const stream = client.beta.messages.stream(
      {
        model: AGENT_MODEL,
        max_tokens: 32000,
        system: [{ type: "text", text: SYSTEM_PROMPT }],
        tools: toolDefinitions,
        messages,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        betas: [FALLBACK_BETA],
        fallbacks: "default",
      },
      { signal },
    );
    stream.on("text", (delta) => emit({ type: "text", delta }));

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Só reexecutamos o turno quando a entrada de uma ferramenta não pôde ser lida (JSON).
      if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIUserAbortError || jsonRetries++ >= MAX_JSON_RETRIES) {
        throw err;
      }
      continue;
    }

    await append(conversationId, "assistant", message.content, { usage: message.usage, stopReason: message.stop_reason });
    await db
      .update(schema.agentConversations)
      .set({ updatedAt: new Date() })
      .where(eq(schema.agentConversations.id, conversationId));

    if (message.stop_reason === "refusal") {
      emit({ type: "notice", tone: "warning", message: "O modelo não pôde responder a este pedido. Reformule a pergunta." });
      break;
    }
    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) break;

    const truncated = message.stop_reason === "max_tokens";
    const results = await Promise.all(
      toolUses.map(async (t) => {
        emit({ type: "tool_start", id: t.id, name: t.name, label: TOOL_LABELS[t.name] ?? t.name });
        const out = truncated
          ? { content: "Não executado: a resposta foi interrompida antes de a entrada terminar.", isError: true }
          : await executeTool(t.name, t.input, { userId, conversationId, toolUseId: t.id, alertDays });
        emit({ type: "tool_end", id: t.id, ok: !out.isError, actionId: "actionId" in out ? out.actionId : undefined });
        return { t, out };
      }),
    );
    for (const { out } of results) {
      if ("actionId" in out && out.actionId) {
        const [a] = await db.select().from(schema.agentActions).where(eq(schema.agentActions.id, out.actionId));
        emit({ type: "action", action: { id: a.id, toolUseId: a.toolUseId, kind: a.kind, summary: a.summary, status: a.status } });
      }
    }
    // Todos os resultados numa única mensagem (preserva chamadas paralelas).
    await append(
      conversationId,
      "user",
      results.map(({ t, out }) => ({
        type: "tool_result",
        tool_use_id: t.id,
        content: out.content,
        ...(out.isError ? { is_error: true } : {}),
      })),
    );
    if (truncated) {
      emit({ type: "notice", tone: "error", message: "A resposta ficou longa demais e foi interrompida." });
      break;
    }
    if (i === MAX_ITERATIONS - 1) {
      emit({ type: "notice", tone: "warning", message: "O agente atingiu o limite de etapas nesta resposta. Envie outra mensagem para continuar." });
    }
  }
  emit({ type: "done" });
}

/** Mensagem de erro segura para a interface, a partir dos erros tipados do SDK. */
export function describeAgentError(err: unknown) {
  if (err instanceof Anthropic.APIUserAbortError) return null;
  if (err instanceof Anthropic.AuthenticationError) return "A chave da API do Claude é inválida. Verifique ANTHROPIC_API_KEY.";
  if (err instanceof Anthropic.RateLimitError) return "Limite de uso da API atingido. Tente de novo em instantes.";
  if (err instanceof Anthropic.BadRequestError) return "A API recusou a requisição. Tente iniciar uma nova conversa.";
  if (err instanceof Anthropic.APIConnectionError) return "Sem conexão com a API do Claude. Tente novamente.";
  if (err instanceof Anthropic.APIError) return "A API do Claude está indisponível no momento. Tente novamente.";
  return "Erro inesperado no agente.";
}

export type { BetaContentBlock };
