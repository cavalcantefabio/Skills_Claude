/** Utilitários de data em "YYYY-MM-DD" (datas civis, sem fuso). */

/** Data de hoje no fuso de Brasília (o servidor pode rodar em UTC). */
export function todayISO(now = new Date(), timeZone = "America/Sao_Paulo") {
  // en-CA formata como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Diferença em dias entre duas datas civis (b − a). */
export function diffDays(a: string, b: string) {
  const toUTC = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

/** Lista de meses "YYYY-MM" terminando no mês de `endISO`, com `count` itens. */
export function monthRange(endISO: string, count: number) {
  const [y, m] = endISO.split("-").map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(dt.toISOString().slice(0, 7));
  }
  return out;
}

export const monthOf = (iso: string) => iso.slice(0, 7);

/** Último dia do mês "YYYY-MM" em ISO. */
export function monthEnd(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
