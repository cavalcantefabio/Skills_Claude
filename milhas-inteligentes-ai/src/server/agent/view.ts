import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { TOOL_LABELS } from "./tools";
import { extractSearchResults, extractWebSources, mergeSources, webSearchLabel, webSearchOk, type WebSource } from "@/lib/web-sources";

export async function listConversations(userId: string) {
  return db
    .select({ id: schema.agentConversations.id, title: schema.agentConversations.title, updatedAt: schema.agentConversations.updatedAt })
    .from(schema.agentConversations)
    .where(eq(schema.agentConversations.userId, userId))
    .orderBy(desc(schema.agentConversations.updatedAt))
    .limit(50);
}

export type ViewAction = { id: string; toolUseId: string; kind: string; summary: string; status: string; resultMessage: string | null };
export type ViewItem =
  | { kind: "user"; text: string }
  | { kind: "notice"; tone: "warning" | "error"; message: string }
  | {
      kind: "assistant";
      parts: ({ type: "text"; text: string } | { type: "tool"; id: string; label: string; ok: boolean })[];
      /** Fontes da web citadas na resposta (só páginas devolvidas pela busca). */
      sources: WebSource[];
      /** Todas as páginas que as buscas devolveram. */
      searched: WebSource[];
    };

/** Converte o histórico da API em itens de interface (oculta pensamento, sistema e resultados crus). */
export async function loadConversationView(userId: string, conversationId: string) {
  const [conv] = await db
    .select()
    .from(schema.agentConversations)
    .where(and(eq(schema.agentConversations.id, conversationId), eq(schema.agentConversations.userId, userId)));
  if (!conv) return null;
  const rows = await db
    .select()
    .from(schema.agentMessages)
    .where(eq(schema.agentMessages.conversationId, conversationId))
    .orderBy(asc(schema.agentMessages.seq));
  const actions = await db
    .select()
    .from(schema.agentActions)
    .where(eq(schema.agentActions.conversationId, conversationId))
    .orderBy(asc(schema.agentActions.createdAt));

  const failedTools = new Set<string>();
  for (const r of rows) {
    if (r.role !== "user") continue;
    for (const b of r.content as { type: string; tool_use_id?: string; is_error?: boolean }[]) {
      if (b.type === "tool_result" && b.is_error && b.tool_use_id) failedTools.add(b.tool_use_id);
    }
  }

  const items: ViewItem[] = [];
  for (const r of rows) {
    const blocks = r.content as Anthropic.Beta.BetaContentBlock[] | { type: string; text?: string }[];
    if (r.role === "user") {
      const text = blocks.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n");
      if (text) items.push({ kind: "user", text });
      if (r.notice) items.push({ kind: "notice", ...(r.notice as { tone: "warning" | "error"; message: string }) });
    } else if (r.role === "assistant") {
      const parts: Extract<ViewItem, { kind: "assistant" }>["parts"] = [];
      const content = blocks as Anthropic.Beta.BetaContentBlock[];
      for (const b of content) {
        if (b.type === "text" && b.text) {
          // Citações dividem o texto em vários blocos: junta para o Markdown não quebrar.
          const prev = parts[parts.length - 1];
          if (prev?.type === "text") prev.text += b.text;
          else parts.push({ type: "text", text: b.text });
        }
        if (b.type === "tool_use") parts.push({ type: "tool", id: b.id, label: TOOL_LABELS[b.name] ?? b.name, ok: !failedTools.has(b.id) });
        if (b.type === "server_tool_use" && b.name === "web_search") {
          const result = content.find((r) => r.type === "web_search_tool_result" && r.tool_use_id === b.id);
          parts.push({ type: "tool", id: b.id, label: webSearchLabel(b.input), ok: result ? webSearchOk((result as { content: unknown }).content) : true });
        }
      }
      const prevItem = items[items.length - 1];
      const searched = mergeSources(prevItem?.kind === "assistant" ? prevItem.searched : [], extractSearchResults(content));
      const sources = extractWebSources(content, searched);
      // Turnos do assistente seguidos (texto + ferramentas) viram um bloco só.
      const last = items[items.length - 1];
      // (um aviso salvo fica depois da resposta parcial, por isso ele é reposicionado no fim)
      if (last?.kind === "assistant") {
        last.parts.push(...parts);
        last.sources = mergeSources(last.sources, sources);
        last.searched = searched;
      } else if (parts.length) items.push({ kind: "assistant", parts, sources, searched });
    }
  }
  return {
    conversation: { id: conv.id, title: conv.title },
    items,
    actions: actions.map((a) => ({ id: a.id, toolUseId: a.toolUseId, kind: a.kind, summary: a.summary, status: a.status, resultMessage: a.resultMessage })),
  };
}
