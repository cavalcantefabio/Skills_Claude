import { describe, expect, it } from "vitest";
import { extractSearchResults, extractWebSources, mergeSources, urlsInText, webSearchLabel, webSearchOk } from "@/lib/web-sources";

describe("fontes da web do agente", () => {
  it("extrai citações da busca, sem repetir URL e só com http(s)", () => {
    const blocks = [
      { type: "server_tool_use" },
      {
        type: "text",
        citations: [
          { type: "web_search_result_location", url: "https://www.exemplo.com/voos", title: "Voos para Lisboa" },
          { type: "web_search_result_location", url: "https://www.exemplo.com/voos", title: "Repetida" },
          { type: "web_search_result_location", url: "javascript:alert(1)", title: "Maliciosa" },
          { type: "char_location", url: "https://ignorada.com" },
        ],
      },
      { type: "text", citations: null },
      { type: "text", citations: [{ type: "web_search_result_location", url: "https://hotel.pt/a", title: null }] },
    ];
    expect(extractWebSources(blocks)).toEqual([
      { url: "https://www.exemplo.com/voos", title: "Voos para Lisboa" },
      { url: "https://hotel.pt/a", title: "hotel.pt" },
    ]);
  });

  it("links no texto só viram fonte quando a busca devolveu a página", () => {
    const searched = extractSearchResults([
      {
        type: "web_search_tool_result",
        content: [
          { type: "web_search_result", url: "https://a.com/voos", title: "Voos A" },
          { type: "web_search_result", url: "javascript:x", title: "x" },
        ],
      },
      { type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "unavailable" } },
    ]);
    expect(searched).toEqual([{ url: "https://a.com/voos", title: "Voos A" }]);
    const text = "Veja [Voos A](https://a.com/voos/#topo), [inventado](https://b.com/x) e https://a.com/voos.";
    expect(urlsInText(text)).toEqual(["https://a.com/voos/#topo", "https://b.com/x", "https://a.com/voos"]);
    expect(extractWebSources([{ type: "text", text, citations: null }], searched)).toEqual([{ url: "https://a.com/voos", title: "Voos A" }]);
  });

  it("junta listas de fontes mantendo a ordem", () => {
    const a = [{ url: "https://a.com", title: "A" }];
    expect(mergeSources(a, [{ url: "https://a.com", title: "A2" }, { url: "https://b.com", title: "B" }]).map((s) => s.url)).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("rótulo do chip e resultado com erro", () => {
    expect(webSearchLabel({ query: "hotel Lisboa março" })).toBe("Pesquisou na web: “hotel Lisboa março”");
    expect(webSearchLabel({})).toBe("Pesquisou na web");
    expect(webSearchOk([])).toBe(true);
    expect(webSearchOk({ type: "web_search_tool_result_error", error_code: "max_uses_exceeded" })).toBe(false);
  });
});
