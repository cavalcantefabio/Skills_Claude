import { describe, expect, it } from "vitest";
import { formatUSD, usageCost } from "@/lib/pricing";

describe("usageCost", () => {
  it("soma entrada, saída, leitura e escrita de cache (Opus 5.5)", () => {
    const r = usageCost(
      { input_tokens: 1000, output_tokens: 2000, cache_read_input_tokens: 10_000, cache_creation: { ephemeral_5m_input_tokens: 4000, ephemeral_1h_input_tokens: 0 } },
      "claude-opus-5-5",
    );
    // 1000×4 + 2000×20 + 10000×0,2 + 4000×4×1,25 = 4000 + 40000 + 2000 + 20000 = 66000 / 1e6
    expect(r.usd).toBeCloseTo(0.066, 9);
    expect(r.knownModel).toBe(true);
    expect(r.tokens.cacheWrite).toBe(4000);
  });

  it("cache de 1 hora custa 2× a entrada", () => {
    const r = usageCost({ cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 1_000_000 } }, "claude-opus-5-5");
    expect(r.usd).toBeCloseTo(8, 9);
  });

  it("sem detalhamento, usa cache_creation_input_tokens como escrita de 5 min", () => {
    expect(usageCost({ cache_creation_input_tokens: 1_000_000 }, "claude-opus-5-5").usd).toBeCloseTo(5, 9);
  });

  it("usa a tabela do modelo de fallback e marca modelo desconhecido", () => {
    expect(usageCost({ output_tokens: 1_000_000 }, "claude-sonnet-5-5").usd).toBe(10);
    const unknown = usageCost({ output_tokens: 1_000_000 }, "modelo-novo");
    expect(unknown.knownModel).toBe(false);
    expect(unknown.usd).toBe(20);
  });

  it("formata valores pequenos sem virar zero", () => {
    expect(formatUSD(0.0434).replace(/ /g, " ")).toBe("US$ 0,043");
    expect(formatUSD(1.5).replace(/ /g, " ")).toBe("US$ 1,50");
    expect(formatUSD(0).replace(/ /g, " ")).toBe("US$ 0,00");
  });
});
