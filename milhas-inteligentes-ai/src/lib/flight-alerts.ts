/**
 * Avisos de rota: critérios escolhidos pela pessoa e a regra que decide se um voo
 * encontrado dispara o aviso. Código puro (sem I/O), usado no servidor e na tela.
 */
import { addDaysISO } from "./dates";

export const DATE_MODES = ["qualquer", "prox30", "prox90", "mes", "datas"] as const;
export const ALERT_CABINS = ["qualquer", "economica", "executiva"] as const;
export const ALERT_PAY = ["qualquer", "milhas", "dinheiro"] as const;

export type DateMode = (typeof DATE_MODES)[number];
export type AlertCabin = (typeof ALERT_CABINS)[number];
export type AlertPay = (typeof ALERT_PAY)[number];

export type AlertCriteria = {
  /** Códigos IATA aceitos na origem e no destino (vazio = qualquer lugar). */
  originCodes: string[];
  destinationCodes: string[];
  dateMode: DateMode;
  /** "YYYY-MM" quando dateMode = "mes". */
  month?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  cabin: AlertCabin;
  pay: AlertPay;
  /** Teto por trecho e por pessoa, como os alertas costumam publicar. */
  maxMiles?: number | null;
  maxCashBrl?: number | null;
};

export type DealLite = {
  origin: string;
  destination: string;
  kind: "milhas" | "dinheiro";
  miles: number | null;
  cashBrl: number | null;
  cabin: string | null;
  /** Período de embarque divulgado (um dia só: dateFrom = dateTo). */
  dateFrom: string | null;
  dateTo: string | null;
};

const lastDayOfMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** Janela de embarque do aviso, relativa à data de referência (null = qualquer data). */
export function alertWindow(c: AlertCriteria, ref: string): { from: string; to: string } | null {
  switch (c.dateMode) {
    case "qualquer":
      return null;
    case "prox30":
      return { from: ref, to: addDaysISO(ref, 30) };
    case "prox90":
      return { from: ref, to: addDaysISO(ref, 90) };
    case "mes":
      return c.month ? { from: `${c.month}-01`, to: lastDayOfMonth(c.month) } : null;
    case "datas":
      return c.dateFrom && c.dateTo ? { from: c.dateFrom, to: c.dateTo } : null;
  }
}

function cabinOk(want: AlertCabin, got: string | null) {
  if (want === "qualquer") return true;
  // Sem classe informada, os alertas são de econômica.
  const g = got ?? "economica";
  return want === "executiva" ? g === "executiva" || g === "primeira" : g === "economica" || g === "premium";
}

/** Motivo de não bater (para testes e explicações) ou null quando o voo dispara o aviso. */
export function mismatch(c: AlertCriteria, d: DealLite, ref: string): string | null {
  if (c.originCodes.length && !c.originCodes.includes(d.origin)) return "origem";
  if (c.destinationCodes.length && !c.destinationCodes.includes(d.destination)) return "destino";
  if (c.pay !== "qualquer" && c.pay !== d.kind) return "pagamento";
  if (!cabinOk(c.cabin, d.cabin)) return "cabine";
  const w = alertWindow(c, ref);
  if (w) {
    // Voo sem data divulgada não confirma a janela escolhida.
    if (!d.dateFrom) return "data";
    const to = d.dateTo ?? d.dateFrom;
    if (to < w.from || d.dateFrom > w.to) return "data";
  }
  if (d.kind === "milhas" && c.maxMiles != null && (d.miles == null || d.miles > c.maxMiles)) return "preco";
  if (d.kind === "dinheiro" && c.maxCashBrl != null && (d.cashBrl == null || d.cashBrl > c.maxCashBrl)) return "preco";
  return null;
}

export const matchesAlert = (c: AlertCriteria, d: DealLite, ref: string) => mismatch(c, d, ref) === null;

/**
 * Quantas vezes o aviso teria tocado nos últimos 30 dias, com os voos já encontrados aqui
 * (cada voo é avaliado na data em que foi encontrado).
 */
export function wouldHaveFired(c: AlertCriteria, deals: readonly (DealLite & { foundOn: string })[], today: string) {
  const since = addDaysISO(today, -30);
  return deals.filter((d) => d.foundOn >= since && matchesAlert(c, d, d.foundOn)).length;
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Próximos meses para os botões de data (a partir do mês seguinte). */
export function monthOptions(today: string, n = 6) {
  const [y, m] = today.split("-").map(Number);
  const out: { value: string; label: string }[] = [];
  for (let i = 1; i <= n; i++) {
    const idx = m - 1 + i;
    const yy = y + Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    out.push({ value: `${yy}-${String(mm).padStart(2, "0")}`, label: yy === y ? MONTHS[mm - 1] : `${MONTHS[mm - 1]} ${yy}` });
  }
  return out;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Resumo em uma linha (lista de avisos, alertas). */
export function describeCriteria(c: AlertCriteria, fmtDate: (iso: string) => string) {
  const parts: string[] = [];
  parts.push(
    c.dateMode === "qualquer"
      ? "qualquer data"
      : c.dateMode === "prox30"
        ? "próximos 30 dias"
        : c.dateMode === "prox90"
          ? "próximos 3 meses"
          : c.dateMode === "mes" && c.month
            ? monthLabel(c.month)
            : c.dateFrom && c.dateTo
              ? `${fmtDate(c.dateFrom)} a ${fmtDate(c.dateTo)}`
              : "datas escolhidas",
  );
  if (c.cabin !== "qualquer") parts.push(c.cabin === "executiva" ? "executiva" : "econômica");
  if (c.pay !== "qualquer") parts.push(c.pay === "milhas" ? "só milhas" : "só dinheiro");
  if (c.maxMiles != null) parts.push(`até ${c.maxMiles.toLocaleString("pt-BR")} milhas`);
  if (c.maxCashBrl != null) parts.push(`até R$ ${c.maxCashBrl.toLocaleString("pt-BR")}`);
  return parts.join(" · ");
}

/** Site para emitir, por programa do catálogo (o botão "Emitir" abre a página inicial do programa). */
export const PROGRAM_SITES: Record<string, string> = {
  smiles: "https://www.smiles.com.br",
  "latam-pass": "https://latampass.latam.com",
  "azul-fidelidade": "https://www.voeazul.com.br",
  "tap-miles-go": "https://www.flytap.com",
  "flying-blue": "https://www.flyingblue.com",
  aadvantage: "https://www.aa.com",
  "iberia-plus": "https://www.iberia.com",
};
