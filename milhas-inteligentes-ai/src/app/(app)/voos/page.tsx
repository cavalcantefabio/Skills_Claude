import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellPlus, CalendarDays, ExternalLink, KeyRound, Pencil, Plane, PlaneTakeoff } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { agentEnabled } from "@/server/agent/client";
import { listAccounts } from "@/server/services/accounts";
import {
  dealsForPreview,
  hitsByDeal,
  lastFlightRun,
  listDeals,
  listRouteAlerts,
  markHitsSeen,
  placesOf,
  type FlightDeal,
} from "@/server/services/flight-alerts";
import { flightRunsToday } from "@/server/flights/run";
import { env } from "@/server/env";
import { AlertSheet, type AlertInitial } from "@/components/flights/alert-sheet";
import { AlertRowActions, SearchFlightsButton, ShareDeal } from "@/components/flights/actions";
import { AskAgent } from "@/components/agent/ask-agent";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, buttonClass, cx } from "@/components/ui";
import { AIRPORT_BY_IATA, cityOf, placesLabel, searchPlaces } from "@/lib/airports";
import { PROGRAM_SITES, describeCriteria } from "@/lib/flight-alerts";
import { dealHeadline, dealInsight, dealWhen, milesShort, type AccountLite } from "@/lib/flight-deal";
import { diffDays, todayISO } from "@/lib/dates";
import { formatBRL, formatDate } from "@/lib/format";
import { formatUSD } from "@/lib/pricing";
import { NotificationsCard } from "@/components/push/notifications-card";
import { vapidKeys } from "@/server/push/send";
import { countDevices } from "@/server/push/devices";

export const metadata: Metadata = { title: "Alertas de Voos" };

const CABIN_LABEL: Record<string, string> = { economica: "Econômica", premium: "Premium", executiva: "Executiva", primeira: "Primeira" };

function ago(d: Date) {
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

function countLast24h(deals: { createdAt: Date }[]) {
  const now = Date.now();
  return deals.filter((d) => now - d.createdAt.getTime() < 86_400_000).length;
}

function dayLabel(iso: string, today: string) {
  const d = diffDays(iso, today);
  return d === 0 ? "Hoje" : d === 1 ? "Ontem" : formatDate(iso);
}

/** Aviso pronto a partir de um voo ("Avisar" no cartão). */
function alertFromDeal(d: FlightDeal): AlertInitial {
  const place = (code: string) => {
    const a = AIRPORT_BY_IATA.get(code);
    return a ? (searchPlaces(code)[0] ?? { kind: "codigo" as const, label: code, codes: [code] }) : { kind: "codigo" as const, label: `Aeroporto ${code}`, codes: [code] };
  };
  return {
    origins: [place(d.origin)],
    destinations: [place(d.destination)],
    dateMode: "qualquer",
    month: null,
    dateFrom: null,
    dateTo: null,
    cabin: "qualquer",
    pay: d.kind,
    maxMiles: null,
    maxCashBrl: null,
  };
}

export default async function VoosPage({ searchParams }: { searchParams: Promise<{ origem?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = todayISO();
  const [alerts, deals, hits, preview, accounts, lastRun, runsToday, vapid, devices] = await Promise.all([
    listRouteAlerts(user.id),
    listDeals(user.id),
    hitsByDeal(user.id),
    dealsForPreview(user.id),
    listAccounts(user.id),
    lastFlightRun(user.id),
    flightRunsToday(user.id),
    vapidKeys(),
    countDevices(user.id),
  ]);
  // A pessoa abriu a página: os disparos passam a "vistos" (o selo "Novo" aparece só desta vez).
  if ([...hits.values()].some((h) => h.unseen)) await markHitsSeen(user.id);
  // Selo "Novo": disparos das últimas 24 h.
  const fresh = new Set([...hits].filter(([, h]) => h.fresh).map(([id]) => id));

  const accLite: AccountLite[] = accounts.map((a) => ({
    programSlug: a.programSlug,
    programName: a.programName,
    kind: a.kind,
    unit: a.unit,
    balance: a.balance,
    milheiroValueBrl: a.milheiroValueBrl,
  }));

  // Filtro de origem: os aeroportos mais frequentes no feed.
  const originCounts = new Map<string, number>();
  for (const d of deals) originCounts.set(d.origin, (originCounts.get(d.origin) ?? 0) + 1);
  const topOrigins = [...originCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
  const selected = (sp.origem ?? "").split(",").filter((c) => /^[A-Z]{3}$/.test(c));
  const shown = selected.length ? deals.filter((d) => selected.includes(d.origin)) : deals;
  const last24h = countLast24h(deals);

  const groups = new Map<string, FlightDeal[]>();
  for (const d of shown) {
    const day = todayISO(d.createdAt);
    groups.set(day, [...(groups.get(day) ?? []), d]);
  }
  const limitReached = runsToday >= env.FLIGHT_SEARCH_DAILY_LIMIT;
  const enabled = agentEnabled();
  const toggleHref = (code: string) => {
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
    return next.length ? `/voos?origem=${next.join(",")}` : "/voos";
  };

  return (
    <>
      <PageHeader
        title="Alertas de Voos"
        description={
          <span className="inline-flex items-center gap-2">
            <span className={cx("size-2 rounded-full", last24h ? "bg-good" : "bg-line-strong")} aria-hidden />
            {last24h} {last24h === 1 ? "voo encontrado" : "voos encontrados"} em 24 h · {deals.length} nos últimos 30 dias
          </span>
        }
        actions={
          enabled ? (
            <SearchFlightsButton
              disabled={limitReached}
              reason={limitReached ? `Limite de ${env.FLIGHT_SEARCH_DAILY_LIMIT} buscas por dia atingido. Volte amanhã.` : undefined}
            />
          ) : undefined
        }
      />

      {!enabled && (
        <Card className="mb-6">
          <div className="flex items-start gap-4 p-6 text-sm text-ink-2">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />
            <p>
              A busca de voos usa a API do Claude. Configure <code className="rounded bg-surface-2 px-1">MILHAS_ANTHROPIC_API_KEY</code> para ativá-la. Os avisos
              podem ser criados mesmo assim.
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Chamada para criar aviso */}
          <section className="rounded-2xl border border-accent/40 bg-accent-soft/40 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">{alerts.length ? "Seus avisos estão ativos" : "Crie um aviso de rota"}</p>
                <p className="mt-0.5 text-sm text-ink-2">
                  Escolha de onde sai, para onde vai, datas, cabine e preço máximo. Quando uma busca achar um voo compatível, ele aparece aqui marcado e em Alertas.
                </p>
              </div>
              <AlertSheet
                today={today}
                previewDeals={preview}
                trigger={
                  <>
                    <BellPlus className="size-4" aria-hidden /> {alerts.length ? "Novo aviso" : "Criar meu primeiro aviso"}
                  </>
                }
                triggerClassName="h-11 shrink-0 px-5 text-[15px]"
              />
            </div>
          </section>

          {topOrigins.length > 1 && (
            <nav aria-label="Filtrar por origem" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              <Link href="/voos" className={cx("shrink-0 rounded-full border px-3 py-1.5 text-sm", !selected.length ? "border-accent bg-accent-soft text-accent-soft-ink" : "border-line text-ink-2")}>
                Todas as origens
              </Link>
              {topOrigins.map((c) => (
                <Link
                  key={c}
                  href={toggleHref(c)}
                  aria-current={selected.includes(c) ? "true" : undefined}
                  className={cx(
                    "shrink-0 rounded-full border px-3 py-1.5 text-sm",
                    selected.includes(c) ? "border-accent bg-accent-soft text-accent-soft-ink" : "border-line text-ink-2 hover:text-ink",
                  )}
                >
                  {cityOf(c)} ({c})
                </Link>
              ))}
            </nav>
          )}

          {shown.length === 0 ? (
            <Card>
              <EmptyState
                icon={Plane}
                title={deals.length ? "Nenhum voo com essa origem" : "Nenhum voo encontrado ainda"}
                description={
                  deals.length
                    ? "Tire o filtro de origem para ver todos."
                    : "Clique em \"Buscar voos agora\": o app procura alertas de passagens publicados nos últimos dias em sites de milhas e confere com os seus avisos."
                }
              />
            </Card>
          ) : (
            [...groups.entries()].map(([day, list]) => (
              <section key={day} aria-label={dayLabel(day, today)} className="space-y-4">
                <p className="mx-auto w-fit rounded-full border border-line-strong px-4 py-1 text-sm text-ink-2">{dayLabel(day, today)}</p>
                {list.map((d) => (
                  <DealCard key={d.id} d={d} accounts={accLite} hit={hits.get(d.id)} isNew={fresh.has(d.id)} today={today} preview={preview} />
                ))}
              </section>
            ))
          )}

          <p className="text-xs text-muted">
            Os voos vêm de alertas publicados em sites de milhas e passagens, sempre com a fonte. Valores por pessoa. Disponibilidade e preço mudam rápido:
            confira no site do programa antes de transferir pontos ou emitir.
          </p>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title="Meus avisos" description={alerts.length ? `${alerts.filter((a) => a.active).length} ativo(s)` : "Nenhum aviso ainda"} />
            <CardBody className="space-y-3">
              {alerts.length === 0 && <p className="text-sm text-ink-2">Crie um aviso para ser avisado quando aparecer um voo na sua rota.</p>}
              {alerts.map((a) => {
                const initial: AlertInitial = {
                  id: a.id,
                  origins: placesOf(a.originPlaces),
                  destinations: placesOf(a.destinationPlaces),
                  dateMode: a.dateMode,
                  month: a.month,
                  dateFrom: a.dateFrom,
                  dateTo: a.dateTo,
                  cabin: a.cabin,
                  pay: a.pay,
                  maxMiles: a.maxMiles,
                  maxCashBrl: a.maxCashBrl == null ? null : Number(a.maxCashBrl),
                };
                return (
                  <div key={a.id} className={cx("rounded-xl border border-line p-3", !a.active && "opacity-60")}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-medium text-ink">
                        {placesLabel(placesOf(a.originPlaces))} <span className="text-muted">→</span> {placesLabel(placesOf(a.destinationPlaces))}
                      </p>
                      <AlertRowActions id={a.id} active={a.active} />
                    </div>
                    <p className="mt-1 text-xs text-ink-2">{describeCriteria({ ...initial, originCodes: [], destinationCodes: [] }, formatDate)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!a.active && <Badge>Pausado</Badge>}
                      <Badge tone={a.hits ? "good" : "neutral"}>
                        <Bell className="size-3" aria-hidden /> {a.hits} {a.hits === 1 ? "voo encontrado" : "voos encontrados"}
                      </Badge>
                      <AlertSheet
                        today={today}
                        previewDeals={preview}
                        initial={initial}
                        triggerVariant="ghost"
                        triggerClassName="h-7 px-2 text-xs"
                        trigger={
                          <>
                            <Pencil className="size-3" aria-hidden /> Editar
                          </>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>
          <NotificationsCard vapidPublicKey={vapid.publicKey} devices={devices} compact />
          <Card>
            <CardBody className="space-y-1 text-xs text-ink-2">
              <p className="font-medium text-ink">Busca automática</p>
              {env.CRON_SECRET ? (
                <p>
                  Às 8h e às 20h (Brasília), para os avisos ativos. {devices ? "Voos novos chegam como notificação." : "Ative as notificações para ser avisado no celular."}
                </p>
              ) : (
                <p>Ainda não configurada: falta a senha da agenda (CRON_SECRET). Enquanto isso, use o botão “Buscar voos agora”.</p>
              )}
            </CardBody>
          </Card>
          {lastRun && (
            <Card>
              <CardBody className="space-y-1 text-xs text-ink-2">
                <p className="font-medium text-ink">Última busca {lastRun.trigger === "automatica" ? "(automática)" : ""}</p>
                <p>
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(lastRun.startedAt)} ·{" "}
                  {lastRun.status === "concluida" ? `${lastRun.found} voo(s) novo(s)` : lastRun.status === "falhou" ? `falhou: ${lastRun.error ?? ""}` : "em andamento"} ·{" "}
                  {lastRun.webSearches} buscas · {formatUSD(Number(lastRun.costUsd))}
                </p>
                {lastRun.summary && <p className="text-muted">{lastRun.summary}</p>}
                <p className="text-muted">
                  Buscas pelo botão hoje: {runsToday} de {env.FLIGHT_SEARCH_DAILY_LIMIT}.
                </p>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}

function DealCard({
  d,
  accounts,
  hit,
  isNew,
  today,
  preview,
}: {
  d: FlightDeal;
  accounts: AccountLite[];
  hit?: { alertIds: string[] };
  isNew: boolean;
  today: string;
  preview: Awaited<ReturnType<typeof dealsForPreview>>;
}) {
  const insight = dealInsight(d, accounts);
  const h = dealHeadline(d);
  const when = dealWhen(d);
  const site = d.programSlug ? PROGRAM_SITES[d.programSlug] : undefined;
  const taxes = d.taxesBrl == null ? null : Number(d.taxesBrl);
  const details = [d.airline, d.cabin ? CABIN_LABEL[d.cabin] : null, d.seats ? `${d.seats} assentos` : null].filter(Boolean);
  return (
    <article className={cx("rounded-3xl border bg-surface p-5 shadow-sm sm:p-6", hit ? "border-accent/60" : "border-line")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent" className="px-3 py-1 text-[13px]">
          {d.kind === "milhas" ? (d.programName ?? "Milhas") : "Dinheiro"}
        </Badge>
        {hit && (
          <Badge tone="good" className="px-3 py-1 text-[13px]">
            <Bell className="size-3.5" aria-hidden /> Seu aviso
          </Badge>
        )}
        {isNew && <Badge tone="warning">Novo</Badge>}
        <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted">
          <span className="size-2 rounded-full bg-good" aria-hidden /> {ago(d.createdAt)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3" aria-label={`De ${cityOf(d.origin)} para ${cityOf(d.destination)}`}>
        <div className="min-w-0">
          <p className="text-4xl font-bold tracking-tight text-ink">{d.origin}</p>
          <p className="truncate text-sm text-ink-2">{cityOf(d.origin)}</p>
        </div>
        <div className="flex flex-1 items-center gap-2 text-muted" aria-hidden>
          <span className="h-px flex-1 border-t border-dashed border-line-strong" />
          <PlaneTakeoff className="size-5" />
          <span className="h-px flex-1 border-t border-dashed border-line-strong" />
        </div>
        <div className="min-w-0 text-right">
          <p className="text-4xl font-bold tracking-tight text-ink">{d.destination}</p>
          <p className="truncate text-sm text-ink-2">{cityOf(d.destination)}</p>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2">
        <CalendarDays className="size-4" aria-hidden />
        {when ?? "Datas: ver na fonte"}
        {d.roundTrip && <span>· ida e volta</span>}
        {details.map((x) => (
          <span key={x as string}>· {x}</span>
        ))}
      </p>

      <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {d.kind === "milhas" ? (
            <p className="text-ink">
              <span className="text-3xl font-bold">{milesShort(d.miles ?? 0)}</span> <span className="text-ink-2">milhas{d.roundTrip ? " (ida e volta)" : ""}</span>
            </p>
          ) : (
            <p className="text-3xl font-bold text-ink">{formatBRL(Number(d.cashBrl))}</p>
          )}
          {taxes != null && <p className="text-sm text-ink-2">+ {formatBRL(taxes)} de taxas</p>}
        </div>
        <a
          href={site ?? d.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={cx(buttonClass("primary"), "h-12 rounded-2xl px-5 text-[15px] font-semibold")}
        >
          {site ? `Emitir na ${d.programName ?? "companhia"}` : "Ver o alerta"} <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>

      <div className={cx("mt-4 rounded-2xl border p-4 text-sm", insight.tone === "good" ? "border-good/40 bg-good-soft/40" : insight.tone === "warning" ? "border-warning/40 bg-warning-soft/40" : "border-line bg-surface-2/60")}>
        <p className="mb-1 font-medium text-ink">Com os seus saldos</p>
        <ul className="space-y-1 text-ink-2">
          {insight.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      {d.notes && <p className="mt-3 text-xs text-ink-2">{d.notes}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AlertSheet
          today={today}
          previewDeals={preview}
          initial={alertFromDeal(d)}
          triggerVariant="secondary"
          trigger={
            <>
              <Bell className="size-3.5" aria-hidden /> Avisar
            </>
          }
        />
        <ShareDeal text={`${h.route}: ${h.price}${h.when ? ` (${h.when})` : ""}`} url={d.sourceUrl} />
        <AskAgent question={`Vi um alerta de voo ${h.route} por ${h.price}${h.when ? ` (${h.when})` : ""}. Vale a pena emitir com os meus saldos? De onde tiro as milhas?`} variant="ghost" label="Perguntar" />
        <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
          Fonte: {d.sourceName ?? new URL(d.sourceUrl).hostname.replace(/^www\./, "")}
          {d.publishedOn ? `, ${formatDate(d.publishedOn)}` : ""} <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
    </article>
  );
}
