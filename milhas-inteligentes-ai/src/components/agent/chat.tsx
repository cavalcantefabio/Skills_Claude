"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, Check, CircleAlert, Loader2, Square, Wrench, X } from "lucide-react";
import { Badge, Button, cx } from "@/components/ui";
import { Markdown } from "./markdown";
import { decideAgentAction } from "@/server/actions/agent";
import type { ViewAction, ViewItem } from "@/server/agent/view";
import type { AgentEvent } from "@/server/agent/run";

type Part = Extract<ViewItem, { kind: "assistant" }>["parts"][number] & { running?: boolean };
type Item = Exclude<ViewItem, { kind: "assistant" }> | { kind: "assistant"; parts: Part[] };

const SUGGESTIONS = [
  "Quais pontos vencem nos próximos 90 dias e o que você sugere fazer com eles?",
  "Qual dos meus cartões rende mais para um gasto de R$ 6.000 por mês?",
  "Vale a pena emitir uma passagem de R$ 1.800 que custa 60.000 milhas Smiles com R$ 90 de taxas?",
  "Quanto falta de milhas para a minha próxima viagem planejada?",
];

const ACTION_LABEL: Record<string, string> = { lancamento: "Lançamento", transferencia: "Transferência", viagem: "Viagem" };
const STATUS_TONE = { pendente: "warning", confirmada: "good", recusada: "neutral", falhou: "critical" } as const;
const STATUS_LABEL: Record<string, string> = { pendente: "Aguardando você", confirmada: "Confirmada", recusada: "Recusada", falhou: "Falhou" };

function ActionCard({ action, onDecided }: { action: ViewAction; onDecided: (a: Partial<ViewAction> & { id: string }) => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const decide = (d: "confirmar" | "recusar") =>
    start(async () => {
      setError(null);
      const res = await decideAgentAction(action.id, d);
      if (res.status) onDecided({ id: action.id, status: res.status, resultMessage: res.message ?? null });
      if (!res.ok) setError(res.message ?? "Não foi possível concluir.");
    });
  return (
    <div className="my-2 rounded-xl border border-line-strong bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Proposta · {ACTION_LABEL[action.kind]}</p>
        <Badge tone={STATUS_TONE[action.status as keyof typeof STATUS_TONE] ?? "neutral"}>{STATUS_LABEL[action.status] ?? action.status}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink">{action.summary}</p>
      {action.resultMessage && action.status !== "pendente" && <p className="mt-1 text-xs text-ink-2">{action.resultMessage}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-critical-ink">
          {error}
        </p>
      )}
      {action.status === "pendente" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" disabled={pending} onClick={() => decide("confirmar")}>
            <Check className="size-3.5" aria-hidden /> Confirmar e registrar
          </Button>
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => decide("recusar")}>
            <X className="size-3.5" aria-hidden /> Recusar
          </Button>
        </div>
      )}
    </div>
  );
}

export function AgentChat({
  conversationId: initialId,
  initialItems,
  initialActions,
  initialInput = "",
}: {
  conversationId: string | null;
  initialItems: ViewItem[];
  initialActions: ViewAction[];
  /** Pergunta preparada por um botão "Perguntar ao agente": fica no campo, sem enviar. */
  initialInput?: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialId);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [actions, setActions] = useState<ViewAction[]>(initialActions);
  const [input, setInput] = useState(initialInput);
  const [prepared, setPrepared] = useState(Boolean(initialInput));
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, actions]);

  const updateAssistant = (fn: (parts: Part[]) => Part[]) =>
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.kind === "assistant") next[next.length - 1] = { kind: "assistant", parts: fn([...last.parts]) };
      else next.push({ kind: "assistant", parts: fn([]) });
      return next;
    });

  const handle = (e: AgentEvent) => {
    switch (e.type) {
      case "conversation":
        setConversationId(e.id);
        window.history.replaceState(null, "", `/agente?c=${e.id}`);
        break;
      case "text":
        updateAssistant((parts) => {
          const last = parts[parts.length - 1];
          if (last?.type === "text") parts[parts.length - 1] = { ...last, text: last.text + e.delta };
          else parts.push({ type: "text", text: e.delta });
          return parts;
        });
        break;
      case "tool_start":
        updateAssistant((parts) => [...parts, { type: "tool", id: e.id, label: e.label, ok: true, running: true }]);
        break;
      case "tool_end":
        updateAssistant((parts) => parts.map((p) => (p.type === "tool" && p.id === e.id ? { ...p, ok: e.ok, running: false } : p)));
        break;
      case "action":
        setActions((prev) => [...prev, { ...e.action, resultMessage: null }]);
        break;
      case "notice":
        setItems((prev) => [...prev, { kind: "notice", tone: e.tone, message: e.message }]);
        break;
      case "done":
        break;
    }
  };

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setPrepared(false);
    setBusy(true);
    setItems((prev) => [...prev, { kind: "user", text: message }]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/agente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erro ao falar com o agente." }));
        setItems((prev) => [...prev, { kind: "notice", tone: "error", message: err.error }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (line) handle(JSON.parse(line.slice(6)) as AgentEvent);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setItems((prev) => [...prev, { kind: "notice", tone: "error", message: "A conexão com o agente caiu. Tente novamente." }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      router.refresh(); // atualiza a lista de conversas e as páginas que mudaram
    }
  }

  const actionsByTool = new Map(actions.map((a) => [a.toolUseId, a]));
  const lastIsAssistantStreaming = busy && items[items.length - 1]?.kind !== "assistant";

  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col">
      <div className="flex-1 space-y-6 pb-6">
        {items.length === 0 && (
          <div className="mx-auto max-w-2xl pt-6 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-soft-ink">
              <Bot className="size-6" aria-hidden />
            </span>
            <h2 className="mt-4 text-lg font-semibold">Como posso ajudar com seus pontos?</h2>
            <p className="mt-1 text-sm text-ink-2">
              O agente consulta seus saldos, cartões e viagens, faz as contas com as calculadoras e pode propor lançamentos, que só são gravados se você confirmar.
            </p>
            <div className="mt-6 grid gap-2 text-left sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((item, i) =>
          item.kind === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14.5px] text-accent-ink">{item.text}</p>
            </div>
          ) : item.kind === "notice" ? (
            <p
              key={i}
              role="alert"
              className={cx(
                "flex items-start gap-2 rounded-xl px-3 py-2 text-sm",
                item.tone === "error" ? "bg-critical-soft text-critical-ink" : "bg-warning-soft text-warning-ink",
              )}
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {item.message}
            </p>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
                <Bot className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 space-y-2">
                {item.parts.map((p, j) =>
                  p.type === "text" ? (
                    <Markdown key={j} text={p.text} />
                  ) : (
                    <div key={p.id}>
                      <span
                        className={cx(
                          "inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs",
                          p.ok ? "text-ink-2" : "text-critical-ink",
                        )}
                      >
                        {p.running ? <Loader2 className="size-3 animate-spin" aria-hidden /> : <Wrench className="size-3" aria-hidden />}
                        {p.label}
                        {!p.ok && " (erro)"}
                      </span>
                      {actionsByTool.get(p.id) && (
                        <ActionCard
                          action={actionsByTool.get(p.id)!}
                          onDecided={(u) => setActions((prev) => prev.map((a) => (a.id === u.id ? { ...a, ...u } : a)))}
                        />
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          ),
        )}
        {lastIsAssistantStreaming && (
          <p className="flex items-center gap-2 pl-10 text-sm text-muted" aria-live="polite">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Pensando…
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-0 -mx-1 bg-bg/90 px-1 pb-4 pt-2 backdrop-blur"
      >
        {prepared && input && (
          <p className="mb-2 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent-soft-ink">
            Pergunta preparada a partir da página anterior. Revise ou edite e clique em enviar; nada é enviado sem você.
          </p>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-line-strong bg-surface p-2 shadow-sm focus-within:border-accent">
          <label htmlFor="agent-input" className="sr-only">
            Mensagem para o agente
          </label>
          <textarea
            id="agent-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={input.length > 90 ? 4 : 1}
            autoFocus={prepared}
            maxLength={4000}
            placeholder="Pergunte sobre seus pontos, cartões ou viagens…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[14.5px] text-ink placeholder:text-muted focus:outline-none focus-visible:outline-none"
          />
          {busy ? (
            <Button type="button" variant="secondary" size="sm" className="size-9 px-0" aria-label="Parar" onClick={() => abortRef.current?.abort()}>
              <Square className="size-3.5" aria-hidden />
            </Button>
          ) : (
            <Button type="submit" size="sm" className="size-9 px-0" aria-label="Enviar" disabled={!input.trim()}>
              <ArrowUp className="size-4" aria-hidden />
            </Button>
          )}
        </div>
        <p className="mt-1.5 px-2 text-[11px] text-muted">
          Respostas geradas por IA a partir dos seus dados cadastrados. Confira valores importantes; o agente não acessa a internet nem dados de mercado.
        </p>
      </form>
    </div>
  );
}
