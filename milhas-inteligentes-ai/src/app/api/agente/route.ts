import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { env } from "@/server/env";
import { agentEnabled, getAnthropic } from "@/server/agent/client";
import {
  createConversation,
  describeAgentError,
  saveNotice,
  messagesToday,
  ownsConversation,
  runAgentTurn,
  type AgentEvent,
} from "@/server/agent/run";

const bodySchema = z.object({
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1, "Mensagem vazia.").max(4000, "Mensagem muito longa (máx. 4.000 caracteres)."),
});

const json = (status: number, message: string) => Response.json({ error: message }, { status });

/** Turno do agente via Server-Sent Events. Uma linha `data:` com JSON por evento. */
export async function POST(request: Request) {
  // Route handlers não têm a checagem de origem das server actions: fazemos aqui (CSRF).
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) return json(403, "Origem não permitida.");

  const user = await getCurrentUser();
  if (!user) return json(401, "Sessão expirada. Entre novamente.");
  if (!agentEnabled()) return json(503, "O agente não está configurado (falta MILHAS_ANTHROPIC_API_KEY).");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, parsed.error.issues[0]?.message ?? "Pedido inválido.");
  if ((await messagesToday(user.id)) >= env.AGENT_DAILY_MESSAGE_LIMIT) {
    return json(429, `Limite diário de ${env.AGENT_DAILY_MESSAGE_LIMIT} mensagens ao agente atingido. Volte amanhã.`);
  }

  let conversationId = parsed.data.conversationId ?? null;
  let created: { id: string; title: string } | null = null;
  if (conversationId) {
    if (!(await ownsConversation(user.id, conversationId))) return json(404, "Conversa não encontrada.");
  } else {
    created = await createConversation(user.id, parsed.data.message);
    conversationId = created.id;
  }

  const encoder = new TextEncoder();
  // Cancela a chamada à API só quando o navegador fecha a conexão (cancel() do stream).
  // request.signal não serve aqui: ele pode disparar assim que a Response é devolvida.
  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          // navegador desconectou
        }
      };
      if (created) emit({ type: "conversation", id: created.id, title: created.title });
      try {
        await runAgentTurn({
          client: getAnthropic(),
          userId: user.id,
          alertDays: user.expiryAlertDays,
          usdRateBrl: user.usdRateBrl,
          conversationId: conversationId!,
          text: parsed.data.message,
          emit,
          signal: abort.signal,
        });
      } catch (err) {
        const message = describeAgentError(err);
        if (message) {
          console.error("agent turn failed", err);
          emit({ type: "notice", tone: "error", message });
          await saveNotice(conversationId!, { tone: "error", message });
        }
        emit({ type: "done" });
      } finally {
        try {
          controller.close();
        } catch {
          // já fechado
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
