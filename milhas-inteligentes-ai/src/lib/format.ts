const ptInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });
const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export const formatPoints = (n: number) => ptInt.format(n);
export const formatBRL = (n: number) => brl.format(n);
export const formatPct = (ratio: number) => pct.format(ratio);
export const formatDecimal = (n: number) => dec.format(n);

/** Formata pontos de forma compacta para eixos: 12,5 mil, 1,2 mi. */
export function formatCompact(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${dec.format(n / 1_000_000)} mi`;
  if (abs >= 10_000) return `${ptInt.format(n / 1_000)} mil`;
  if (abs >= 1_000) return `${dec.format(n / 1_000)} mil`;
  return ptInt.format(n);
}

/** "2026-03-05" → "05/03/2026" sem conversão de fuso. */
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "2026-03" → "mar/26" */
export function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
}
