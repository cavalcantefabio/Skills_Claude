/**
 * Planejador inteligente de viagens: cálculo puro (sem I/O).
 *
 * Regras:
 * - Preços e milhas vêm só de cotações (reais ou estimativas com fonte); nada é inventado.
 * - Programas diferentes nunca são somados, exceto pontos de banco convertidos para a companhia
 *   pela paridade (premissa 1:1, ou a da promoção vigente do Radar), sempre sinalizado.
 * - Compra de pontos só é recomendada quando o milheiro comprado custa menos do que rende na emissão.
 */
import { addDaysISO, diffDays } from "@/lib/dates";

export type TripLite = {
  passengers: number;
  tripType: "ida_volta" | "ida";
  departDate: string | null;
  budgetBrl: number | null;
};

export type QuoteLite = {
  id: string;
  kind: "milhas" | "dinheiro";
  certainty: "real" | "estimativa";
  programId: string | null;
  label: string | null;
  milesPerPax: number | null;
  taxesPerPaxBrl: number | null;
  cashPerPaxBrl: number | null;
  covers: "ida_volta" | "ida";
  sourceUrl: string | null;
  checkedOn: string;
};

export type PlanAccount = {
  id: string;
  programId: string;
  programSlug: string;
  programName: string;
  kind: string;
  unit: string;
  balance: number;
  milheiroValueBrl: number | null;
  /** Média mensal de pontos ganhos (acúmulos e bônus) nos últimos meses. */
  monthlyAccrual: number;
  /** Pontos que vencem antes do embarque (só informativo). */
  expiringBeforeTrip?: number;
};

export type PlanPromo = {
  kind: "transferencia" | "compra" | "outra";
  title: string;
  fromSlug: string | null;
  toSlug: string | null;
  bonusPct: number | null;
  ratioFrom: number | null;
  ratioTo: number | null;
  pricePerThousandBrl: number | null;
  endsOn: string | null;
};

export type TransferSource = {
  accountId: string;
  programName: string;
  balance: number;
  ratioFrom: number;
  ratioTo: number;
  bonusPct: number;
  /** Paridade/bônus vêm de promoção vigente do Radar (senão é a premissa 1:1 sem bônus). */
  fromPromo: string | null;
  received: number;
};

export type Scenario = {
  name: string;
  /** "calculado" usa dados reais; "hipotetico" depende de uma premissa explícita. */
  basis: "calculado" | "hipotetico";
  months: number | null;
  reachDate: string | null;
  onTime: boolean | null;
  extraCostBrl: number | null;
  description: string;
};

export type ProgramOption = {
  quote: QuoteLite;
  programId: string;
  programName: string;
  unit: string;
  totalMiles: number;
  totalTaxesBrl: number;
  direct: number;
  transfers: TransferSource[];
  available: number;
  remaining: number;
  progress: number;
  monthlyRate: number;
  scenarios: Scenario[];
  /** Valor que cada milheiro rende nesta emissão, comparado ao preço em dinheiro. */
  valuePerThousandBrl: number | null;
  /** Taxas + milhas valorizadas pelo milheiro de referência da pessoa. */
  economicCostBrl: number | null;
  /** Compra do que falta, se houver preço conhecido (promoção do Radar). */
  purchase: { pricePerThousandBrl: number; costBrl: number; worth: boolean; source: string } | null;
  /** Desembolso em dinheiro no caminho das milhas (taxas + compra, se necessária). */
  cashOutlayBrl: number | null;
  feasibleBeforeTrip: boolean | null;
};

export type Action = { priority: "alta" | "media" | "baixa"; text: string };

export type TripPlan = {
  legsFactorNote: string | null;
  cash: { quote: QuoteLite; totalBrl: number } | null;
  options: ProgramOption[];
  best: ProgramOption | null;
  recommendation: { kind: "milhas" | "dinheiro" | "indefinido"; title: string; reasons: string[] };
  /** Meta = milhas totais do melhor programa. */
  goalMiles: number | null;
  estimatedCostBrl: number | null;
  budget: { budgetBrl: number; withinBudget: boolean } | null;
  onlyEstimates: boolean;
  actions: Action[];
};

/** Fator de trechos: cotação só de ida numa viagem de ida e volta conta em dobro. */
export const legsFactor = (trip: TripLite, q: QuoteLite) => (trip.tripType === "ida_volta" && q.covers === "ida" ? 2 : 1);

export function receivedMiles(points: number, ratioFrom: number, ratioTo: number, bonusPct: number) {
  return Math.floor(((points * ratioTo) / ratioFrom) * (1 + bonusPct / 100));
}

/** Meses necessários para juntar `remaining` com `monthly` por mês (null se nunca). */
export function monthsToReach(remaining: number, monthly: number) {
  if (remaining <= 0) return 0;
  if (monthly <= 0) return null;
  return Math.ceil(remaining / monthly);
}

const addMonths = (iso: string, months: number) => addDaysISO(iso, Math.round(months * 30.44));

function bestTransferPromo(promos: PlanPromo[], fromSlug: string, toSlug: string) {
  return promos
    .filter((p) => p.kind === "transferencia" && p.fromSlug === fromSlug && p.toSlug === toSlug)
    .sort((a, b) => (b.bonusPct ?? 0) - (a.bonusPct ?? 0))[0];
}

function bestBuyPromo(promos: PlanPromo[], slug: string) {
  return promos
    .filter((p) => p.kind === "compra" && p.toSlug === slug && p.pricePerThousandBrl != null)
    .map((p) => ({ p, effective: p.pricePerThousandBrl! / (1 + (p.bonusPct ?? 0) / 100) }))
    .sort((a, b) => a.effective - b.effective)[0];
}

export function buildTripPlan(input: {
  trip: TripLite;
  quotes: QuoteLite[];
  accounts: PlanAccount[];
  promos: PlanPromo[];
  today: string;
}): TripPlan {
  const { trip, quotes, accounts, promos, today } = input;
  const pax = Math.max(1, trip.passengers);
  const banks = accounts.filter((a) => a.kind === "banco");

  // Cotações reais (consultadas pela pessoa) sempre têm prioridade sobre estimativas:
  // uma referência "a partir de" nunca substitui um valor real consultado.
  const realFirst = (a: QuoteLite, b: QuoteLite) => Number(a.certainty === "estimativa") - Number(b.certainty === "estimativa");

  // Melhor cotação em dinheiro: real primeiro, depois o menor total.
  const cashQuotes = quotes
    .filter((q) => q.kind === "dinheiro" && q.cashPerPaxBrl != null)
    .map((q) => ({ quote: q, totalBrl: q.cashPerPaxBrl! * pax * legsFactor(trip, q) }))
    .sort((a, b) => realFirst(a.quote, b.quote) || a.totalBrl - b.totalBrl);
  const cash = cashQuotes[0] ?? null;

  // Para cada programa: cotação real primeiro, depois a com menos milhas.
  const byProgram = new Map<string, QuoteLite>();
  for (const q of quotes) {
    if (q.kind !== "milhas" || !q.programId || !q.milesPerPax) continue;
    const cur = byProgram.get(q.programId);
    const better = !cur || realFirst(q, cur) < 0 || (realFirst(q, cur) === 0 && q.milesPerPax * legsFactor(trip, q) < cur.milesPerPax! * legsFactor(trip, cur));
    if (better) byProgram.set(q.programId, q);
  }

  const options: ProgramOption[] = [];
  for (const [programId, q] of byProgram) {
    const target = accounts.find((a) => a.programId === programId);
    const factor = legsFactor(trip, q);
    const totalMiles = q.milesPerPax! * pax * factor;
    const totalTaxesBrl = (q.taxesPerPaxBrl ?? 0) * pax * factor;
    const direct = target?.balance ?? 0;

    const transfers: TransferSource[] = target
      ? banks
          .filter((b) => b.balance > 0)
          .map((b) => {
            const promo = bestTransferPromo(promos, b.programSlug, target.programSlug);
            const rf = promo?.ratioFrom && promo.ratioFrom > 0 ? promo.ratioFrom : 1;
            const rt = promo?.ratioTo && promo.ratioTo > 0 ? promo.ratioTo : 1;
            const bonus = promo?.bonusPct ?? 0;
            return {
              accountId: b.id,
              programName: b.programName,
              balance: b.balance,
              ratioFrom: rf,
              ratioTo: rt,
              bonusPct: bonus,
              fromPromo: promo ? promo.title : null,
              received: receivedMiles(b.balance, rf, rt, bonus),
            };
          })
      : [];
    const available = direct + transfers.reduce((s, t) => s + t.received, 0);
    const remaining = Math.max(0, totalMiles - available);
    const progress = totalMiles > 0 ? Math.min(1, available / totalMiles) : 0;
    const monthlyRate = (target?.monthlyAccrual ?? 0) + banks.reduce((s, b) => s + b.monthlyAccrual, 0);

    const deadline = trip.departDate;
    const scenario = (name: string, basis: Scenario["basis"], months: number | null, extraCostBrl: number | null, description: string): Scenario => {
      const reachDate = months == null ? null : months === 0 ? today : addMonths(today, months);
      return { name, basis, months, reachDate, onTime: reachDate && deadline ? reachDate <= deadline : null, extraCostBrl, description };
    };

    const scenarios: Scenario[] = [];
    const m0 = monthsToReach(remaining, monthlyRate);
    scenarios.push(
      scenario(
        "Ritmo atual",
        "calculado",
        m0,
        null,
        remaining === 0
          ? "Seu saldo (com transferências) já cobre a meta."
          : monthlyRate > 0
            ? `Acumulando cerca de ${Math.round(monthlyRate).toLocaleString("pt-BR")} pontos por mês (média recente).`
            : "Sem acúmulo recente registrado: no ritmo atual a meta não é atingida.",
      ),
    );
    // Transferência bonificada hipotética (só se houver bancos com saldo e nenhuma promoção vigente).
    const bankBalance = banks.reduce((s, b) => s + b.balance, 0);
    if (target && remaining > 0 && bankBalance > 0 && !transfers.some((t) => t.fromPromo)) {
      const withBonus = direct + banks.reduce((s, b) => s + receivedMiles(b.balance, 1, 1, 80), 0);
      const rem = Math.max(0, totalMiles - withBonus);
      scenarios.push(
        scenario(
          "Com transferência bonificada",
          "hipotetico",
          monthsToReach(rem, monthlyRate),
          null,
          "Se surgir uma promoção de 80% de bônus para transferir seus pontos de banco (premissa; acompanhe o Radar).",
        ),
      );
    }
    const buyPromo = target ? bestBuyPromo(promos, target.programSlug) : undefined;
    const valuePerThousandBrl = cash && totalMiles > 0 ? (cash.totalBrl - totalTaxesBrl) / (totalMiles / 1000) : null;
    let purchase: ProgramOption["purchase"] = null;
    if (remaining > 0 && buyPromo) {
      const costBrl = (remaining / 1000) * buyPromo.effective;
      const worth = valuePerThousandBrl != null && buyPromo.effective < valuePerThousandBrl;
      purchase = { pricePerThousandBrl: buyPromo.effective, costBrl, worth, source: buyPromo.p.title };
      scenarios.push(
        scenario(
          "Comprando o que falta",
          "calculado",
          0,
          costBrl,
          `Comprar ${remaining.toLocaleString("pt-BR")} milhas na promoção "${buyPromo.p.title}" a cerca de R$ ${buyPromo.effective.toFixed(2).replace(".", ",")} o milheiro.`,
        ),
      );
    }

    const milheiro = target?.milheiroValueBrl ?? null;
    const economicCostBrl = milheiro != null ? totalTaxesBrl + (totalMiles / 1000) * milheiro : null;
    const cashOutlayBrl = remaining === 0 ? totalTaxesBrl : purchase ? totalTaxesBrl + purchase.costBrl : null;
    const feasibleBeforeTrip = remaining === 0 ? true : scenarios.some((s) => s.basis === "calculado" && s.onTime === true) ? true : deadline ? false : null;

    options.push({
      quote: q,
      programId,
      programName: target?.programName ?? q.label ?? "Programa",
      unit: target?.unit ?? "milhas",
      totalMiles,
      totalTaxesBrl,
      direct,
      transfers,
      available,
      remaining,
      progress,
      monthlyRate,
      scenarios,
      valuePerThousandBrl,
      economicCostBrl,
      purchase,
      cashOutlayBrl,
      feasibleBeforeTrip,
    });
  }

  // Melhor programa: viável antes da viagem, depois menor custo econômico (ou menos milhas faltando).
  const rank = (o: ProgramOption) => [o.feasibleBeforeTrip === false ? 1 : 0, o.economicCostBrl ?? Number.MAX_SAFE_INTEGER, o.remaining, o.totalMiles];
  const sorted = [...options].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return 0;
  });
  const best = sorted[0] ?? null;

  // Recomendação: milhas x dinheiro.
  const reasons: string[] = [];
  let recommendation: TripPlan["recommendation"];
  if (!best && !cash) {
    recommendation = { kind: "indefinido", title: "Cadastre cotações para comparar", reasons: ["Sem cotações não há como calcular a meta nem comparar com dinheiro."] };
  } else if (!best) {
    recommendation = { kind: "indefinido", title: "Cadastre uma cotação em milhas", reasons: ["Só há preço em dinheiro: falta a cotação em milhas para comparar."] };
  } else {
    const milheiro = accounts.find((a) => a.programId === best.programId)?.milheiroValueBrl ?? null;
    if (cash && best.valuePerThousandBrl != null && milheiro != null) {
      const milesWin = best.valuePerThousandBrl > milheiro;
      reasons.push(
        `Cada milheiro de ${best.programName} rende R$ ${best.valuePerThousandBrl.toFixed(2).replace(".", ",")} nesta viagem, contra R$ ${milheiro.toFixed(2).replace(".", ",")} do seu valor de referência.`,
      );
      if (!milesWin) {
        recommendation = { kind: "dinheiro", title: "Pagar em dinheiro parece mais vantajoso", reasons };
      } else {
        recommendation = { kind: "milhas", title: `Emitir com ${best.programName}`, reasons };
      }
    } else {
      recommendation = { kind: "milhas", title: `Priorizar ${best.programName}`, reasons };
      if (!cash) reasons.push("Sem cotação em dinheiro, não dá para dizer se milhas compensam.");
      if (milheiro == null) reasons.push(`Defina o valor do milheiro de ${best.programName} para comparar com dinheiro.`);
    }
    if (best.remaining === 0) reasons.push("Seu saldo, contando transferências, já cobre a meta.");
    else if (best.feasibleBeforeTrip === false) reasons.push("No ritmo atual a meta não é atingida antes do embarque.");
  }

  const estimatedCostBrl =
    recommendation.kind === "dinheiro" ? (cash?.totalBrl ?? null) : best ? (best.cashOutlayBrl ?? best.totalTaxesBrl) : (cash?.totalBrl ?? null);
  const budget =
    trip.budgetBrl != null && estimatedCostBrl != null ? { budgetBrl: trip.budgetBrl, withinBudget: estimatedCostBrl <= trip.budgetBrl } : null;

  // Próximas ações.
  const actions: Action[] = [];
  const onlyEstimates = quotes.length > 0 && quotes.every((q) => q.certainty === "estimativa");
  if (!quotes.some((q) => q.kind === "milhas")) actions.push({ priority: "alta", text: "Consulte no site do programa quantas milhas a viagem custa e cadastre a cotação." });
  if (!cash) actions.push({ priority: "media", text: "Cadastre o preço em dinheiro para comparar com milhas." });
  if (onlyEstimates) actions.push({ priority: "alta", text: "As cotações são só estimativas: confirme preços e disponibilidade no site antes de decidir." });
  if (best) {
    const promoTransfer = best.transfers.find((t) => t.fromPromo);
    if (promoTransfer && best.remaining < best.totalMiles) {
      actions.push({
        priority: "alta",
        text: `Promoção vigente: "${promoTransfer.fromPromo}". Transferir ${promoTransfer.balance.toLocaleString("pt-BR")} pontos de ${promoTransfer.programName} renderia ${promoTransfer.received.toLocaleString("pt-BR")} ${best.unit}. Confirme a disponibilidade da emissão antes, porque transferências são irreversíveis.`,
      });
    } else if (best.transfers.length && best.direct < best.totalMiles) {
      actions.push({ priority: "media", text: `Não transfira pontos de banco sem promoção: aguarde uma transferência bonificada para ${best.programName} (o Radar avisa).` });
    }
    if (best.remaining > 0) {
      if (best.purchase?.worth) {
        actions.push({ priority: "media", text: `Comprar as ${best.remaining.toLocaleString("pt-BR")} ${best.unit} que faltam compensa: cada milheiro custa menos do que rende nesta emissão.` });
      } else if (best.purchase) {
        actions.push({ priority: "baixa", text: "Comprar o que falta não compensa nos preços atuais: o milheiro comprado custaria mais do que rende." });
      }
      if (best.feasibleBeforeTrip === false) actions.push({ priority: "alta", text: "No ritmo atual você não chega à meta antes do embarque: aumente o acúmulo, aguarde uma promoção ou considere pagar em dinheiro." });
    }
    const exp = accounts.find((a) => a.programId === best.programId)?.expiringBeforeTrip;
    if (exp) actions.push({ priority: "media", text: `${exp.toLocaleString("pt-BR")} ${best.unit} de ${best.programName} vencem antes do embarque: emita antes do vencimento para usá-las.` });
  }
  if (budget && !budget.withinBudget) actions.push({ priority: "media", text: "O custo estimado passa do seu orçamento." });

  return {
    legsFactorNote: [...byProgram.values(), ...(cash ? [cash.quote] : [])].some((q) => legsFactor(trip, q) === 2)
      ? "Cotações só de ida foram contadas em dobro (viagem de ida e volta)."
      : null,
    cash,
    options: sorted,
    best,
    recommendation,
    goalMiles: best?.totalMiles ?? null,
    estimatedCostBrl,
    budget,
    onlyEstimates,
    actions,
  };
}

/** Simulador de esforço extra: meses para a meta com gasto extra no cartão e/ou compra mensal. */
export function simulateExtra(input: {
  remaining: number;
  monthlyRate: number;
  extraSpendBrl: number;
  pointsPerBrl: number;
  monthlyPurchase: number;
}) {
  const monthly = input.monthlyRate + input.extraSpendBrl * input.pointsPerBrl + input.monthlyPurchase;
  return { monthly, months: monthsToReach(input.remaining, monthly) };
}

export { diffDays };
