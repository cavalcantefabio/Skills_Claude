import { describe, expect, it } from "vitest";
import { ASK_MAX_LENGTH, askAgentHref } from "@/lib/ask-agent";

describe("askAgentHref", () => {
  it("codifica a pergunta na URL do agente", () => {
    expect(askAgentHref("Vale a pena? 50% & R$ 1.800")).toBe("/agente?q=Vale%20a%20pena%3F%2050%25%20%26%20R%24%201.800");
  });
  it("limita o tamanho da pergunta", () => {
    const q = decodeURIComponent(askAgentHref("x".repeat(2000)).split("q=")[1]);
    expect(q).toHaveLength(ASK_MAX_LENGTH);
  });
});
