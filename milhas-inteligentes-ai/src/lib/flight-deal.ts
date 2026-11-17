/** Textos e contas dos cartões de voo (código puro). */
import { formatBRL, formatDate, formatPoints } from "./format";
import { cityOf } from "./airports";

export type DealView = {
  origin: string;
  destination: string;
  kind: "milhas" | "dinheiro";
  programSlug: string | null;
  programName: string | null;
  miles: number | null;
  taxesBrl: string | number | null;
  cashBrl: string | number | null;
  roundTrip: boolean;
  dateFrom: string | null;
  dateTo: string | null;
};

export type AccountLite = { programSlug: string; programName: string; kind: string; unit: string; balance: number; milheiroValueBrl: number | null };

const n = (v: string | number | null) => (v == null ? null : Number(v));

/** 30500 → "30,5k"; 120000 → "120k". */
export function milesShort(m: number) {
  if (m < 1000) return formatPoints(m);
  const k = m / 1000;
  return `${k.toLocaleString("pt-BR", { maximumFractionDigits: k < 100 ? 1 : 0 })}k`;
}

export function dealWhen(d: Pick<DealView, "dateFrom" | "dateTo">) {
  if (!d.dateFrom) return null;
  if (!d.dateTo || d.dateTo === d.dateFrom) return formatDate(d.dateFrom);
  return `${formatDate(d.dateFrom)} a ${formatDate(d.dateTo)}`;
}

export function dealHeadline(d: DealView) {
  const taxes = n(d.taxesBrl);
  const trip = d.roundTrip ? " ida e volta" : "";
  const price =
    d.kind === "milhas"
      ? `${formatPoints(d.miles ?? 0)} milhas${d.programName ? ` ${d.programName}` : ""}${taxes != null ? ` + ${formatBRL(taxes)} de taxas` : ""}${trip}`
      : `${formatBRL(n(d.cashBrl) ?? 0)}${trip}`;
  return { route: `${d.origin} (${cityOf(d.origin)}) → ${d.destination} (${cityOf(d.destination)})`, price, when: dealWhen(d) };
}

export type DealInsight = { tone: "good" | "warning" | "neutral"; lines: string[] };

/**
 * O que este voo significa para os saldos da pessoa (por passageiro). Pontos de banco
 * entram pela premissa de transferência 1:1, que precisa ser conferida no programa.
 */
export function dealInsight(d: DealView, accounts: readonly AccountLite[]): DealInsight {
  if (d.kind === "dinheiro") return { tone: "neutral", lines: ["Preço em dinheiro por pessoa, segundo a fonte."] };
  const miles = d.miles ?? 0;
  const taxesKnown = n(d.taxesBrl);
  const taxes = taxesKnown ?? 0;
  const acc = d.programSlug ? accounts.find((a) => a.programSlug === d.programSlug) : undefined;
  const lines: string[] = [];
  const banks = accounts.filter((a) => a.kind === "banco" && a.balance > 0).sort((a, b) => b.balance - a.balance);
  let tone: DealInsight["tone"] = "neutral";
  if (!d.programSlug) {
    lines.push("Programa não identificado na fonte.");
  } else if (!acc) {
    lines.push(`Você não tem conta ${d.programName ?? d.programSlug} cadastrada.`);
  } else if (acc.balance >= miles) {
    tone = "good";
    lines.push(`Você já pode emitir: tem ${formatPoints(acc.balance)} ${acc.unit} ${acc.programName}.`);
  } else {
    const missing = miles - acc.balance;
    const bank = banks.find((b) => b.balance >= missing);
    tone = bank ? "good" : "warning";
    lines.push(
      bank
        ? `Faltam ${formatPoints(missing)}: seus ${formatPoints(bank.balance)} ${bank.unit} ${bank.programName} cobrem por transferência (premissa 1:1; confira a paridade).`
        : `Faltam ${formatPoints(missing)} ${acc.unit} ${acc.programName} (você tem ${formatPoints(acc.balance)}).`,
    );
  }
  const value = acc?.milheiroValueBrl;
  if (value) {
    lines.push(
      taxesKnown != null
        ? `Pelo valor do seu milheiro (${formatBRL(value)}): ~${formatBRL((miles / 1000) * value + taxes)} com taxas.`
        : `Pelo valor do seu milheiro (${formatBRL(value)}): ~${formatBRL((miles / 1000) * value)} em milhas (taxas não informadas).`,
    );
  }
  return { tone, lines };
}
