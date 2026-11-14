import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight, Map as MapIcon, Plus } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { loadTripPlans } from "@/server/services/trip-plan";
import { Badge, Card, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";
import { CABIN_LABEL, TRIP_STATUS_LABEL } from "@/lib/labels";
import { diffDays, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Minhas Viagens" };

const recTone = { milhas: "good", dinheiro: "accent", indefinido: "warning" } as const;

export default async function TripsPage() {
  const user = await requireUser();
  const trips = await loadTripPlans(user.id);
  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Minhas Viagens"
        description="Metas de milhas para cada viagem, com o que você já tem, quanto falta, o custo estimado e a estratégia recomendada."
        actions={
          <LinkButton href="/viagens/nova">
            <Plus className="size-4" aria-hidden /> Nova viagem
          </LinkButton>
        }
      />
      {trips.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapIcon}
            title="Nenhuma viagem planejada"
            description="Cadastre origem, destino, datas e passageiros. Depois registre as cotações em milhas e em dinheiro para o app montar o plano."
            action={<LinkButton href="/viagens/nova">Planejar viagem</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {trips.map(({ trip, plan }) => {
            const best = plan.best;
            const days = trip.departDate ? diffDays(today, trip.departDate) : null;
            return (
              <Link key={trip.id} href={`/viagens/${trip.id}`} className="group rounded-2xl focus-visible:outline-offset-4">
                <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{trip.title}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                        {trip.origin} <ArrowRight className="size-3.5" aria-hidden /> {trip.destination}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {trip.departDate ? formatDate(trip.departDate) : "Data a definir"}
                        {trip.returnDate && ` – ${formatDate(trip.returnDate)}`}
                        {trip.flexDays > 0 && ` (±${trip.flexDays} dias)`} · {trip.passengers} passageiro(s) · {CABIN_LABEL[trip.cabin]}
                        {days != null && days >= 0 && ` · faltam ${days} dias`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={trip.status === "emitida" ? "good" : trip.status === "cancelada" ? "critical" : "neutral"}>{TRIP_STATUS_LABEL[trip.status]}</Badge>
                      <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </div>
                  </div>

                  {best ? (
                    <>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                        <div>
                          <dt className="text-xs text-muted">Meta</dt>
                          <dd className="tabular font-semibold">{formatPoints(best.totalMiles)}</dd>
                          <dd className="text-[11px] text-muted">{best.programName}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Disponível</dt>
                          <dd className="tabular font-semibold">{formatPoints(best.available)}</dd>
                          {best.transfers.length > 0 && <dd className="text-[11px] text-muted">com transferências</dd>}
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Faltam</dt>
                          <dd className="tabular font-semibold">{formatPoints(best.remaining)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Custo estimado</dt>
                          <dd className="tabular font-semibold">{plan.estimatedCostBrl != null ? formatBRL(plan.estimatedCostBrl) : "—"}</dd>
                          {plan.budget && (
                            <dd className={cx("text-[11px]", plan.budget.withinBudget ? "text-good-ink" : "text-critical-ink")}>
                              {plan.budget.withinBudget ? "dentro do orçamento" : "acima do orçamento"}
                            </dd>
                          )}
                        </div>
                      </dl>
                      <div className="mt-4">
                        <div className="mb-1.5 flex justify-between text-xs">
                          <span className="text-ink-2">Meta atingida</span>
                          <span className="tabular font-medium">{Math.round(best.progress * 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(best.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-2 rounded-full bg-[var(--series-3)]" style={{ width: `${Math.max(best.progress * 100, 1.5)}%` }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-ink">Sem cotação em milhas ainda: abra a viagem e registre quanto ela custa.</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone={recTone[plan.recommendation.kind]}>Estratégia</Badge>
                    <span className="text-sm font-medium">{plan.recommendation.title}</span>
                    {plan.onlyEstimates && <Badge tone="warning">Só estimativas</Badge>}
                  </div>
                  {plan.actions.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink-2">
                      {plan.actions.slice(0, 2).map((a) => (
                        <li key={a.text} className="flex gap-2">
                          <span className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", a.priority === "alta" ? "bg-critical" : "bg-line-strong")} aria-hidden />
                          <span className="line-clamp-2">{a.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
