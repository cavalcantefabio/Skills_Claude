/**
 * Estimativa de custo das chamadas à API do Claude, em US$.
 * Tabela de preços por milhão de tokens (preços públicos de nov/2026). A fatura da Anthropic
 * é a referência oficial; isto serve para acompanhar o gasto dentro do app.
 */
type Rates = { input: number; output: number; cacheRead: number };

export const PRICING_AS_OF = "2026-11";

const RATES: Record<string, Rates> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};
const DEFAULT_MODEL = "claude-opus-5-5";

/** Subconjunto do objeto `usage` devolvido pela API que entra no custo. */
export type UsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null;
};

/** Normaliza ids com sufixos (ex.: datas ou "[1m]") para a chave da tabela. */
function ratesFor(model: string | null | undefined): { rates: Rates; known: boolean } {
  const id = (model ?? "").toLowerCase();
  const key = Object.keys(RATES)
    .sort((a, b) => b.length - a.length)
    .find((k) => id.startsWith(k));
  return key ? { rates: RATES[key], known: true } : { rates: RATES[DEFAULT_MODEL], known: false };
}

export function usageCost(usage: UsageLike, model?: string | null) {
  const { rates, known } = ratesFor(model);
  const n = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? v : 0);
  const input = n(usage.input_tokens);
  const output = n(usage.output_tokens);
  const cacheRead = n(usage.cache_read_input_tokens);
  // Escrita em cache: 1,25× a entrada (5 min) ou 2× (1 h). Sem detalhamento, assume 5 min.
  const w1h = n(usage.cache_creation?.ephemeral_1h_input_tokens);
  const w5m = usage.cache_creation ? n(usage.cache_creation.ephemeral_5m_input_tokens) : n(usage.cache_creation_input_tokens);
  const usd =
    (input * rates.input + output * rates.output + cacheRead * rates.cacheRead + w5m * rates.input * 1.25 + w1h * rates.input * 2) /
    1_000_000;
  return { usd, knownModel: known, tokens: { input, output, cacheRead, cacheWrite: w5m + w1h } };
}

const usdFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdFine = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** US$ com 2 casas; valores pequenos (< US$ 0,10) com 3 casas para não virarem "US$ 0,00". */
export function formatUSD(v: number) {
  return v > 0 && v < 0.1 ? usdFine.format(v) : usdFmt.format(v);
}
