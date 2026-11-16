/** Fontes da web citadas pelo agente (blocos de texto com citações da busca). */
export type WebSource = { url: string; title: string };

type Block = { type: string; citations?: { type: string; url?: string; title?: string | null }[] | null };

/** Só links http(s): o resto (javascript:, data:...) não vira link na tela. */
export function isSafeUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

type ResultBlock = { type: string; content?: unknown };

/** Normaliza para comparar URLs (ignora âncora e barra final). */
function keyOf(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** Páginas devolvidas pelas buscas na web (o que o modelo de fato recebeu). */
export function extractSearchResults(blocks: readonly ResultBlock[]): WebSource[] {
  const out: WebSource[] = [];
  for (const b of blocks) {
    if (b.type !== "web_search_tool_result" || !Array.isArray(b.content)) continue;
    for (const r of b.content as { type?: string; url?: string; title?: string | null }[]) {
      if (r.type !== "web_search_result" || !r.url || !isSafeUrl(r.url)) continue;
      out.push({ url: r.url, title: (r.title ?? "").trim() || hostOf(r.url) });
    }
  }
  return mergeSources([], out);
}

/** URLs http(s) escritas no texto (links Markdown ou soltos). */
export function urlsInText(text: string) {
  return [...text.matchAll(/https?:\/\/[^\s<>()\[\]"']+[^\s<>()\[\]"'.,;:!?]/g)].map((m) => m[0]);
}

/**
 * Fontes da resposta: citações da API e links no texto que apontam para uma página
 * devolvida pela busca. Um link que não veio da busca não entra na lista de fontes.
 */
export function extractWebSources(blocks: readonly (Block & { text?: string })[], searched: readonly WebSource[] = []): WebSource[] {
  const out: WebSource[] = [];
  const byKey = new Map(searched.map((s) => [keyOf(s.url), s]));
  for (const b of blocks) {
    if (b.type !== "text") continue;
    for (const c of b.citations ?? []) {
      if (c.type !== "web_search_result_location" || !c.url || !isSafeUrl(c.url)) continue;
      out.push({ url: c.url, title: (c.title ?? "").trim() || hostOf(c.url) });
    }
    for (const url of urlsInText(b.text ?? "")) {
      const found = byKey.get(keyOf(url));
      if (found) out.push(found);
    }
  }
  return mergeSources([], out);
}

export function mergeSources(a: readonly WebSource[], b: readonly WebSource[]): WebSource[] {
  const seen = new Set(a.map((s) => s.url));
  const out = [...a];
  for (const s of b) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Rótulo do chip de busca: mostra o termo pesquisado quando houver. */
export function webSearchLabel(input: unknown) {
  const q = input && typeof input === "object" && "query" in input ? String((input as { query: unknown }).query ?? "").trim() : "";
  return q ? `Pesquisou na web: “${q.slice(0, 80)}”` : "Pesquisou na web";
}

/** O resultado da busca é uma lista; um objeto indica erro (ex.: limite de buscas). */
export function webSearchOk(content: unknown) {
  return Array.isArray(content);
}
