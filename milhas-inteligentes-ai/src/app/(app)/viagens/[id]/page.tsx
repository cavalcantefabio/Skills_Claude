import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, CircleAlert, ExternalLink, Pencil, Radar as RadarIcon } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { goalProgressSeries, loadTripPlans } from "@/server/services/trip-plan";
import { listCards } from "@/server/services/cards";
import { listSelectablePrograms } from "@/server/services/accounts";
import { latestRadar } from "@/server/radar/run";
import { addQuote, deleteQuote } from "@/server/actions/trips";
import { AskAgent } from "@/components/agent/ask-agent";
import { QuoteForm } from "@/components/trips/quote-form";
import { ResearchButton } from "@/components/trips/research-button";
import { agentEnabled } from "@/server/agent/client";
import { StrategySimulator } from "@/components/trips/simulator";
import { ChartCard, GoalChart } from "@/components/charts/charts";
import { DeleteButton } from "@/components/forms/submit";
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, StatTile, Table, cx, td, th } from "@/components/ui";
import { formatBRL, formatDate, formatPoints, monthLabel } from "@/lib/format";
import { CABIN_LABEL } from "@/lib/labels";
import { diffDays, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Plano da viagem" };

const brl = (v: number | null) => (v == null ? "—" : formatBRL(v));

export default async function TripPlanPage({ params }: PageProps<"/viagens/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [[row], cards, programs, radar] = await Promise.all([
    loadTripPlans(user.id, id),
    listCards(user.id),
    listSelectablePrograms(user.id),
    latestRadar(user.id),
  ]);
  if (!row) notFound();
  const { trip, plan, quotes, accounts } = row;
  const best = plan.best;
  const today = todayISO();
  const days = trip.departDate ? diffDays(today, trip.departDate) : null;

  const targetAccount = best ? accounts.find((a) => a.programId === best.programId) : undefined;
  const goalAccounts = best ? [...(targetAccount ? [targetAccount.id] : []), ...best.transfers.map((t) => t.accountId)] : [];
  const series = best ? await goalProgressSeries(user.id, goalAccounts) : [];

  // Promoções do Radar ligadas aos programas desta viagem.
  const slugs = new Set(plan.options.map((o) => accounts.find((a) => a.programId === o.programId)?.programSlug).filter(Boolean));
  const relatedPromos = (radar?.opportunities ?? []).filter((o) => (!o.endsOn || o.endsOn >= today) && o.toSlug && slugs.has(o.toSlug));

  const cardOptions = cards
    .map((c) => ({ id: c.id, label: `${c.issuer} ${c.name}`, pointsPerBrl: c.pointsPerBrl ?? (c.pointsPerUsd ?? 0) / user.usdRateBrl }))
    .filter((c) => c.pointsPerBrl > 0);

  return (
    <>
      <PageHeader
        title={trip.title}
        description={
          <span>
            {trip.origin} → {trip.destination} ·{" "}
            {trip.departDate ? formatDate(trip.departDate) : "data a definir"}
            {trip.returnDate && ` – ${formatDate(trip.returnDate)}`}
            {trip.flexDays > 0 && ` (±${trip.flexDays} dias)`} · {trip.tripType === "ida" ? "só ida" : "ida e volta"} · {trip.passengers} passageiro(s) ·{" "}
            {CABIN_LABEL[trip.cabin]}
            {days != null && days >= 0 && ` · embarque em ${days} dias`}
          </span>
        }
        actions={
          <>
            <AskAgent
              size="md"
              question={`Para a minha viagem "${trip.title}" (${trip.origin} → ${trip.destination}), qual estratégia devo usar? Qual programa priorizar, vale comprar pontos e como chegar à meta gastando menos?`}
            />
            <LinkButton href={`/viagens/${trip.id}/editar`} variant="secondary">
              <Pencil className="size-4" aria-hidden /> Editar
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Meta de milhas" value={best ? formatPoints(best.totalMiles) : "—"} sub={best ? `${best.programName}${best.quote.certainty === "estimativa" ? " · estimativa" : ""}` : "Sem cotação em milhas"} />
        <StatTile label="Saldo disponível" value={best ? formatPoints(best.available) : "—"} sub={best?.transfers.length ? `${formatPoints(best.direct)} diretos + transferências` : undefined} />
        <StatTile label="Milhas restantes" value={best ? formatPoints(best.remaining) : "—"} />
        <StatTile label="Meta atingida" value={best ? `${Math.round(best.progress * 100)}%` : "—"} />
        <StatTile
          label="Custo estimado"
          value={brl(plan.estimatedCostBrl)}
          sub={plan.budget ? (plan.budget.withinBudget ? `Dentro do orçamento de ${formatBRL(plan.budget.budgetBrl)}` : `Acima do orçamento de ${formatBRL(plan.budget.budgetBrl)}`) : "Defina um orçamento ao editar"}
        />
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Estratégia recomendada" description="Calculada a partir das cotações, dos seus saldos e das promoções vigentes do Radar." />
          <CardBody>
            <p className="flex items-center gap-2 text-base font-semibold">
              {plan.recommendation.kind === "indefinido" ? (
                <CircleAlert className="size-5 text-warning-ink" aria-hidden />
              ) : (
                <CheckCircle2 className="size-5 text-good-ink" aria-hidden />
              )}
              {plan.recommendation.title}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink-2">
              {plan.recommendation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {plan.legsFactorNote && <p className="mt-3 text-xs text-muted">{plan.legsFactorNote}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Próximas ações" />
          <CardBody>
            {plan.actions.length === 0 ? (
              <p className="text-sm text-muted">Nada pendente: acompanhe a evolução da meta.</p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {plan.actions.map((a) => (
                  <li key={a.text} className="flex gap-2.5 text-sm">
                    <Badge tone={a.priority === "alta" ? "critical" : a.priority === "media" ? "warning" : "neutral"} className="mt-0.5 shrink-0">
                      {{ alta: "Alta", media: "Média", baixa: "Baixa" }[a.priority]}
                    </Badge>
                    <span className="text-ink-2">{a.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      {plan.options.length > 0 && (
        <Card className="mt-4">
          <CardHeader
            title="Comparação de programas"
            description="Saldo disponível inclui pontos de banco convertidos pela paridade (1:1 por premissa, ou a da promoção vigente). Custo econômico = taxas + milhas valorizadas pelo seu valor de milheiro."
          />
          <CardBody>
            <Table>
              <thead>
                <tr>
                  <th className={th}>Programa</th>
                  <th className={`${th} text-right`}>Meta</th>
                  <th className={`${th} text-right`}>Taxas</th>
                  <th className={`${th} text-right`}>Disponível</th>
                  <th className={`${th} text-right`}>Faltam</th>
                  <th className={`${th} text-right`}>Milheiro rende</th>
                  <th className={`${th} text-right`}>Custo econômico</th>
                  <th className={th}>Antes do embarque?</th>
                </tr>
              </thead>
              <tbody>
                {plan.options.map((o) => (
                  <tr key={o.programId} className={o === best ? "bg-accent-soft/40" : undefined}>
                    <td className={td}>
                      <span className="font-medium">{o.programName}</span>
                      {o.quote.certainty === "estimativa" && <Badge tone="warning" className="ml-2">estimativa</Badge>}
                    </td>
                    <td className={`${td} tabular text-right`}>{formatPoints(o.totalMiles)}</td>
                    <td className={`${td} tabular text-right`}>{formatBRL(o.totalTaxesBrl)}</td>
                    <td className={`${td} tabular text-right`}>{formatPoints(o.available)}</td>
                    <td className={`${td} tabular text-right`}>{formatPoints(o.remaining)}</td>
                    <td className={`${td} tabular text-right`}>{brl(o.valuePerThousandBrl)}</td>
                    <td className={`${td} tabular text-right`}>{brl(o.economicCostBrl)}</td>
                    <td className={td}>{o.feasibleBeforeTrip == null ? "—" : o.feasibleBeforeTrip ? <Badge tone="good">Sim</Badge> : <Badge tone="critical">Não</Badge>}</td>
                  </tr>
                ))}
                {plan.cash && (
                  <tr>
                    <td className={td}>
                      <span className="font-medium">Dinheiro</span>
                      {plan.cash.quote.certainty === "estimativa" && <Badge tone="warning" className="ml-2">estimativa</Badge>}
                    </td>
                    <td className={`${td} text-right text-muted`} colSpan={5}>
                      {plan.cash.quote.label ?? "Preço total"}
                    </td>
                    <td className={`${td} tabular text-right`}>{formatBRL(plan.cash.totalBrl)}</td>
                    <td className={td}>—</td>
                  </tr>
                )}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {best && (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title={`Cenários para ${best.programName}`} description="Calculados com seus dados; hipóteses aparecem marcadas." />
            <CardBody>
              <ul className="flex flex-col gap-3">
                {best.scenarios.map((s) => (
                  <li key={s.name} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{s.name}</p>
                      <Badge tone={s.basis === "hipotetico" ? "warning" : "neutral"}>{s.basis === "hipotetico" ? "hipótese" : "calculado"}</Badge>
                      {s.onTime != null && <Badge tone={s.onTime ? "good" : "critical"}>{s.onTime ? "antes do embarque" : "depois do embarque"}</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-ink-2">
                      {s.months == null ? "Não atinge a meta." : s.months === 0 ? "Meta coberta agora." : `${s.months} mês(es), por volta de ${formatDate(s.reachDate)}.`}
                      {s.extraCostBrl != null && ` Custo extra: ${formatBRL(s.extraCostBrl)}.`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{s.description}</p>
                  </li>
                ))}
              </ul>
              {best.transfers.length > 0 && (
                <div className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
                  <p className="font-medium text-ink">Transferências consideradas</p>
                  {best.transfers.map((t) => (
                    <p key={t.accountId} className="mt-1">
                      {formatPoints(t.balance)} {t.programName} → {formatPoints(t.received)} {best.unit} (paridade {t.ratioFrom}:{t.ratioTo}
                      {t.bonusPct ? `, bônus ${t.bonusPct}%` : ""}) · {t.fromPromo ? `promoção: ${t.fromPromo}` : "premissa, confirme a parceria no site"}
                    </p>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
          <div className="flex flex-col gap-4">
            {best.remaining > 0 && (
              <StrategySimulator remaining={best.remaining} monthlyRate={best.monthlyRate} unit={best.unit} departDate={trip.departDate} today={today} cards={cardOptions} />
            )}
            {series.length > 0 && (
              <ChartCard
                title="Evolução da meta"
                description={`Saldo de ${best.programName} + pontos de banco (premissa 1:1) ao fim de cada mês, frente à meta.`}
                table={{ columns: ["Mês", "Potencial"], rows: series.map((r) => [monthLabel(r.month), formatPoints(r.value)]) }}
              >
                <GoalChart data={series} goal={best.totalMiles} unit={best.unit} />
              </ChartCard>
            )}
          </div>
        </div>
      )}

      {relatedPromos.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Promoções do Radar para esta viagem" description="Vigentes na última atualização do Radar. Confirme no site antes de transferir." />
          <CardBody>
            <ul className="flex flex-col gap-2">
              {relatedPromos.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <RadarIcon className="size-4 text-ink-2" aria-hidden />
                  <span>{o.title}</span>
                  {o.endsOn && <Badge>até {formatDate(o.endsOn)}</Badge>}
                  <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    fonte <ExternalLink className="size-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-w-0">
          <CardHeader
            title="Cotações"
            description="Valores por passageiro. Real = você consultou; estimativa = referência com fonte."
            actions={agentEnabled() ? <ResearchButton tripId={trip.id} /> : undefined}
          />
          <CardBody>
            {quotes.length === 0 ? (
              <p className="py-4 text-sm text-muted">Nenhuma cotação. Consulte o site do programa e da companhia e registre ao lado.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Tipo</th>
                    <th className={th}>Programa / site</th>
                    <th className={`${th} text-right`}>Por passageiro</th>
                    <th className={th}>Cobre</th>
                    <th className={th}>Origem</th>
                    <th className={th}>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map(({ quote: q, programName }) => (
                    <tr key={q.id}>
                      <td className={td}>{q.kind === "milhas" ? "Milhas" : "Dinheiro"}</td>
                      <td className={td}>{q.kind === "milhas" ? programName : (q.label ?? "—")}</td>
                      <td className={`${td} tabular text-right`}>
                        {q.kind === "milhas"
                          ? `${formatPoints(q.milesPerPax!)}${q.taxesPerPaxBrl ? ` + ${formatBRL(Number(q.taxesPerPaxBrl))}` : ""}`
                          : formatBRL(Number(q.cashPerPaxBrl))}
                      </td>
                      <td className={td}>{q.covers === "ida" ? "1 trecho" : "ida e volta"}</td>
                      <td className={cx(td, "text-xs")}>
                        <Badge tone={q.certainty === "real" ? "good" : "warning"}>{q.certainty === "real" ? "real" : "estimativa"}</Badge>
                        <span className="ml-1.5 text-muted">{formatDate(q.checkedOn)}</span>
                        {q.sourceUrl && (
                          <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="ml-1.5 text-accent hover:underline">
                            fonte
                          </a>
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        <DeleteButton action={deleteQuote} id={q.id} confirmText="Excluir esta cotação?" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
        <QuoteForm
          action={addQuote.bind(null, trip.id)}
          today={today}
          programs={programs.filter((p) => p.kind === "aerea" || p.kind === "hotel" || p.custom).map((p) => ({ id: p.id, name: p.name }))}
        />
      </div>

      <p className="mt-6 text-xs text-muted">
        O app não consulta preços nem disponibilidade em tempo real: os valores vêm das cotações registradas. Estimativas e premissas aparecem marcadas.
        Nenhuma compra ou transferência é feita pelo app.
      </p>
    </>
  );
}
