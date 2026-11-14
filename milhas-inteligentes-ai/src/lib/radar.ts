/**
 * Radar de Oportunidades: cálculo puro do impacto de uma promoção nos saldos da pessoa.
 * Sem I/O, para ser testável e reutilizável pelo agente.
 */
import { formatBRL, formatPoints } from "@/lib/format";

export type OpportunityLite = {
  kind: "transferencia" | "compra" | "outra";
  fromSlug: string | null;
  toSlug: string | null;
  bonusPct: number | null;
  ratioFrom: number | null;
  ratioTo: number | null;
  discountPct: number | null;
  pricePerThousandBrl: number | null;
};

export type AccountLite = {
  programSlug: string;
  programName: string;
  unit: string;
  balance: number;
  milheiroValueBrl: number | null;
};

export type Insight = {
  /** Envolve algum programa que a pessoa tem cadastrado. */
  relevant: boolean;
  /** Avaliação objetiva quando há dados suficientes. */
  tone: "favoravel" | "neutro" | "desfavoravel" | null;
  lines: string[];
};

/** Milhas recebidas numa transferência (arredonda para baixo, como os programas). */
export function received(points: number, ratioFrom: number, ratioTo: number, bonusPct: number) {
  return Math.floor(((points * ratioTo) / ratioFrom) * (1 + bonusPct / 100));
}

export function opportunityInsight(o: OpportunityLite, accounts: AccountLite[]): Insight {
  const from = o.fromSlug ? accounts.find((a) => a.programSlug === o.fromSlug) : undefined;
  const to = o.toSlug ? accounts.find((a) => a.programSlug === o.toSlug) : undefined;

  if (o.kind === "transferencia") {
    const lines: string[] = [];
    const rf = o.ratioFrom && o.ratioFrom > 0 ? o.ratioFrom : 1;
    const rt = o.ratioTo && o.ratioTo > 0 ? o.ratioTo : 1;
    const bonus = o.bonusPct ?? 0;
    let tone: Insight["tone"] = null;
    if (from && from.balance > 0) {
      const got = received(from.balance, rf, rt, bonus);
      lines.push(
        `Com seus ${formatPoints(from.balance)} ${from.unit} ${from.programName}, chegariam ${formatPoints(got)} ${to?.unit ?? "milhas"}.`,
      );
      if (from.milheiroValueBrl != null && got > 0) {
        const cost = (from.balance / 1000) * from.milheiroValueBrl / (got / 1000);
        let line = `Custo efetivo de ${formatBRL(cost)} por milheiro no destino`;
        if (to?.milheiroValueBrl != null) {
          line += `, contra ${formatBRL(to.milheiroValueBrl)} do seu valor de referência`;
          tone = cost < to.milheiroValueBrl * 0.95 ? "favoravel" : cost > to.milheiroValueBrl * 1.05 ? "desfavoravel" : "neutro";
        }
        lines.push(`${line}.`);
      }
    } else if (from) {
      lines.push(`Você tem ${from.programName}, mas está sem saldo.`);
    }
    return { relevant: Boolean(from || to), tone, lines };
  }

  if (o.kind === "compra") {
    const acc = to ?? from;
    const lines: string[] = [];
    let tone: Insight["tone"] = null;
    if (acc && o.pricePerThousandBrl != null) {
      const effective = o.pricePerThousandBrl / (1 + (o.bonusPct ?? 0) / 100);
      let line = `Custo efetivo de ${formatBRL(effective)} por milheiro`;
      if (acc.milheiroValueBrl != null) {
        line += `, contra ${formatBRL(acc.milheiroValueBrl)} do seu valor de referência em ${acc.programName}`;
        tone = effective < acc.milheiroValueBrl * 0.95 ? "favoravel" : effective > acc.milheiroValueBrl * 1.05 ? "desfavoravel" : "neutro";
      }
      lines.push(`${line}.`);
    }
    return { relevant: Boolean(acc), tone, lines };
  }

  return { relevant: Boolean(from || to), tone: null, lines: [] };
}
