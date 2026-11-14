import "server-only";
import { listAccounts, listLots } from "@/server/services/accounts";
import { loadTripPlans } from "@/server/services/trip-plan";
import { latestRadar } from "@/server/radar/run";
import { opportunityInsight } from "@/lib/radar";
import { diffDays, todayISO } from "@/lib/dates";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";

export type Alert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href: string;
  /** Pergunta preparada para o botão "Perguntar ao agente". */
  question: string;
};

/**
 * Alertas calculados a partir dos dados cadastrados (nada é buscado fora do app).
 * Chamada sob demanda a cada visita; notificações por e-mail/push ficam para a próxima etapa.
 */
export async function computeAlerts(userId: string, alertDays: number): Promise<Alert[]> {
  const today = todayISO();
  const [accounts, lots] = await Promise.all([listAccounts(userId, alertDays), listLots(userId)]);
  const out: Alert[] = [];

  for (const l of lots) {
    if (!l.expiresAt) continue;
    const d = diffDays(today, l.expiresAt);
    if (d < 0) {
      out.push({
        id: `expired-${l.id}`,
        severity: "critical",
        title: `${formatPoints(l.remaining)} ${l.unit} vencidos em ${l.programName}`,
        description: `A validade terminou em ${formatDate(l.expiresAt)}. Se o programa já baixou os pontos, lance uma expiração para manter o saldo correto.`,
        href: `/programas/${l.accountId}`,
        question: `Tenho ${formatPoints(l.remaining)} ${l.unit} de ${l.programName} com validade em ${formatDate(l.expiresAt)}, que já passou. O que devo fazer para deixar o saldo correto e o que ainda dá para aproveitar?`,
      });
    } else if (d <= alertDays) {
      out.push({
        id: `expiring-${l.id}`,
        severity: d <= 30 ? "critical" : "warning",
        title: `${formatPoints(l.remaining)} ${l.unit} de ${l.programName} vencem em ${d} dia(s)`,
        description: `Validade em ${formatDate(l.expiresAt)}. Use, transfira ou renove antes de perder os pontos.`,
        href: `/programas/${l.accountId}`,
        question: `Tenho ${formatPoints(l.remaining)} ${l.unit} de ${l.programName} que vencem em ${formatDate(l.expiresAt)} (${d} dias). Considerando meus programas e viagens planejadas, o que você sugere fazer com esses pontos?`,
      });
    }
  }

  for (const a of accounts) {
    if (a.clubMonthlyCostBrl && a.clubMonthlyPoints != null && a.milheiroValueBrl) {
      const value = (a.clubMonthlyPoints / 1000) * a.milheiroValueBrl;
      if (value < a.clubMonthlyCostBrl) {
        out.push({
          id: `club-${a.id}`,
          severity: "warning",
          title: `${a.clubName ?? "Clube"} custa mais do que os pontos mensais valem`,
          description: `${formatPoints(a.clubMonthlyPoints)} ${a.unit}/mês valem ${formatBRL(value)} pelo seu milheiro, contra ${formatBRL(a.clubMonthlyCostBrl)} de mensalidade. Bônus de transferência podem compensar: confira na calculadora de clubes.`,
          href: "/calculadoras?c=clube_pontos",
          question: `Meu ${a.clubName ?? "clube"} de ${a.programName} custa ${formatBRL(a.clubMonthlyCostBrl)} por mês e dá ${formatPoints(a.clubMonthlyPoints)} ${a.unit}. Vale a pena continuar assinando? Faça a conta considerando também bônus de transferência.`,
        });
      }
    }
    if (a.milheiroValueBrl == null) {
      out.push({
        id: `nomilheiro-${a.id}`,
        severity: "info",
        title: `Defina o valor do milheiro de ${a.programName}`,
        description: "Sem ele, este programa fica fora do valor econômico estimado e das comparações.",
        href: `/programas/${a.id}`,
        question: `Me ajude a definir um valor de referência para o milheiro de ${a.programName}. Que critérios devo usar, considerando como costumo usar esses pontos?`,
      });
    }
  }

  // Viagens: alertas a partir do plano (meta, promoções e cotações).
  const plans = await loadTripPlans(userId);
  for (const { trip, plan } of plans) {
    if (trip.status !== "planejada") continue;
    const d = trip.departDate ? diffDays(today, trip.departDate) : null;
    if (d != null && d < 0) continue;
    const best = plan.best;
    const href = `/viagens/${trip.id}`;
    if (best && best.remaining > 0 && d != null && d <= trip.alertDaysBefore) {
      out.push({
        id: `trip-goal-${trip.id}`,
        severity: best.feasibleBeforeTrip === false ? "critical" : "warning",
        title: `Meta da viagem "${trip.title}": faltam ${formatPoints(best.remaining)} ${best.unit}`,
        description: `Embarque em ${d} dia(s) (${formatDate(trip.departDate)}). ${best.feasibleBeforeTrip === false ? "No ritmo atual a meta não fecha a tempo." : "Acompanhe a evolução da meta."}`,
        href,
        question: `Para a viagem "${trip.title}" (${trip.origin} → ${trip.destination}), faltam ${formatPoints(best.remaining)} ${best.unit} em ${best.programName} e o embarque é em ${d} dias. Como atingir a meta gastando menos? Vale comprar pontos?`,
      });
    }
    const promo = best?.transfers.find((t) => t.fromPromo);
    if (trip.watchPromotions && best && promo) {
      out.push({
        id: `trip-promo-${trip.id}`,
        severity: "warning",
        title: `Promoção para a viagem "${trip.title}"`,
        description: `${promo.fromPromo}: ${formatPoints(promo.balance)} ${promo.programName} renderiam ${formatPoints(promo.received)} ${best.unit}. Confirme a emissão antes de transferir.`,
        href,
        question: `Há uma promoção ("${promo.fromPromo}") que ajuda na viagem "${trip.title}". Devo transferir agora? Quanto?`,
      });
    }
    if (plan.onlyEstimates && d != null && d <= 120) {
      out.push({
        id: `trip-est-${trip.id}`,
        severity: "info",
        title: `Confirme os preços da viagem "${trip.title}"`,
        description: "O plano usa só estimativas. Consulte o site do programa e registre uma cotação real.",
        href,
        question: `Quais cotações devo conferir para a viagem "${trip.title}" antes de decidir?`,
      });
    }
  }

  // Promoções vigentes do último radar que envolvem programas da pessoa.
  const radar = await latestRadar(userId);
  for (const o of radar?.opportunities ?? []) {
    if (o.endsOn && o.endsOn < today) continue;
    const num = (v: string | null) => (v == null ? null : Number(v));
    const insight = opportunityInsight(
      {
        kind: o.kind,
        fromSlug: o.fromSlug,
        toSlug: o.toSlug,
        bonusPct: num(o.bonusPct),
        ratioFrom: num(o.ratioFrom),
        ratioTo: num(o.ratioTo),
        discountPct: num(o.discountPct),
        pricePerThousandBrl: num(o.pricePerThousandBrl),
      },
      accounts.map((a) => ({ programSlug: a.programSlug, programName: a.programName, unit: a.unit, balance: a.balance, milheiroValueBrl: a.milheiroValueBrl })),
    );
    if (!insight.relevant || insight.tone === "desfavoravel") continue;
    out.push({
      id: `radar-${o.id}`,
      severity: insight.tone === "favoravel" ? "warning" : "info",
      title: `Promoção: ${o.title}`,
      description: [o.endsOn ? `Válida até ${formatDate(o.endsOn)}.` : "Término não informado.", ...insight.lines].join(" "),
      href: "/radar",
      question: `Encontrei esta promoção no radar: "${o.title}"${o.endsOn ? `, válida até ${formatDate(o.endsOn)}` : ""}. Vale a pena aproveitar com os meus saldos? Quanto devo transferir ou comprar?`,
    });
  }

  const rank = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
