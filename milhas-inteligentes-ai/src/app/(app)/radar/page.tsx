import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, CircleAlert, ExternalLink, KeyRound, MinusCircle, Radar as RadarIcon } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { agentEnabled } from "@/server/agent/client";
import { listAccounts } from "@/server/services/accounts";
import { latestRadar, radarRunsToday } from "@/server/radar/run";
import { env } from "@/server/env";
import { RefreshRadarButton } from "@/components/radar/refresh-button";
import { AskAgent } from "@/components/agent/ask-agent";
import { Badge, Card, CardBody, EmptyState, PageHeader, cx } from "@/components/ui";
import { opportunityInsight, type Insight } from "@/lib/radar";
import { diffDays, todayISO } from "@/lib/dates";
import { formatDate, formatDecimal } from "@/lib/format";
import { formatUSD } from "@/lib/pricing";

export const metadata: Metadata = { title: "Radar de Oportunidades" };

const GROUPS = [
  { kind: "transferencia", title: "Transferências bonificadas" },
  { kind: "compra", title: "Compra de pontos e milhas" },
  { kind: "outra", title: "Outras promoções" },
] as const;

const toneUi = {
  favoravel: { icon: CheckCircle2, label: "Vale a pena para você", tone: "good", color: "text-good-ink" },
  neutro: { icon: MinusCircle, label: "Empate com seu milheiro", tone: "neutral", color: "text-ink-2" },
  desfavoravel: { icon: CircleAlert, label: "Mais caro que seu milheiro", tone: "critical", color: "text-critical-ink" },
} as const;

const n = (v: string | null) => (v == null ? null : Number(v));
const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(d);

export default async function RadarPage() {
  const user = await requireUser();
  if (!agentEnabled()) {
    return (
      <>
        <PageHeader title="Radar de Oportunidades" />
        <Card>
          <div className="flex items-start gap-4 p-6 text-sm text-ink-2">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />
            <p>O Radar pesquisa promoções com a API do Claude. Configure <code className="rounded bg-surface-2 px-1">MILHAS_ANTHROPIC_API_KEY</code> para ativá-lo.</p>
          </div>
        </Card>
      </>
    );
  }

  const [latest, accounts, runsToday] = await Promise.all([latestRadar(user.id), listAccounts(user.id), radarRunsToday(user.id)]);
  const limitReached = runsToday >= env.RADAR_DAILY_LIMIT;
  const today = todayISO();
  const accLite = accounts.map((a) => ({
    programSlug: a.programSlug,
    programName: a.programName,
    unit: a.unit,
    balance: a.balance,
    milheiroValueBrl: a.milheiroValueBrl,
  }));

  const items = (latest?.opportunities ?? [])
    .filter((o) => !o.endsOn || o.endsOn >= today)
    .map((o) => {
      const insight: Insight = opportunityInsight(
        {
          kind: o.kind,
          fromSlug: o.fromSlug,
          toSlug: o.toSlug,
          bonusPct: n(o.bonusPct),
          ratioFrom: n(o.ratioFrom),
          ratioTo: n(o.ratioTo),
          discountPct: n(o.discountPct),
          pricePerThousandBrl: n(o.pricePerThousandBrl),
        },
        accLite,
      );
      return { o, insight };
    })
    .sort((a, b) => Number(b.insight.relevant) - Number(a.insight.relevant) || (a.o.endsOn ?? "9999").localeCompare(b.o.endsOn ?? "9999"));

  return (
    <>
      <PageHeader
        title="Radar de Oportunidades"
        description="Promoções vigentes de transferência bonificada e compra de pontos, encontradas pelo Claude em sites oficiais e blogs de milhas, com o cálculo para os seus saldos."
        actions={
          <RefreshRadarButton
            disabled={limitReached}
            reason={limitReached ? `Limite de ${env.RADAR_DAILY_LIMIT} atualizações por dia atingido.` : undefined}
          />
        }
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col gap-2 pt-5 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {latest ? (
              <>
                Atualizado em <span className="font-medium text-ink">{fmtDateTime(latest.run.finishedAt ?? latest.run.startedAt)}</span> ·{" "}
                {latest.run.webSearches} busca(s) · {formatUSD(Number(latest.run.costUsd))}
              </>
            ) : (
              "Ainda não atualizado."
            )}
          </p>
          <p className="text-xs text-muted">
            Atualizações hoje: {runsToday} de {env.RADAR_DAILY_LIMIT}
          </p>
        </CardBody>
        {latest?.run.summary && <p className="border-t border-line px-6 py-4 text-sm text-ink">{latest.run.summary}</p>}
      </Card>

      {!latest ? (
        <Card>
          <EmptyState
            icon={RadarIcon}
            title="Nenhuma pesquisa feita ainda"
            description="Clique em Atualizar radar. O Claude pesquisa as promoções vigentes e o app calcula o efeito nos seus saldos. Cada atualização custa cerca de US$ 0,35."
          />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={RadarIcon} title="Nenhuma promoção vigente encontrada" description="Tente de novo em outro dia: as campanhas costumam mudar toda semana." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {GROUPS.map((g) => {
            const list = items.filter((i) => i.o.kind === g.kind);
            if (!list.length) return null;
            return (
              <section key={g.kind}>
                <h2 className="mb-3 text-[15px] font-semibold">{g.title}</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {list.map(({ o, insight }) => {
                    const days = o.endsOn ? diffDays(today, o.endsOn) : null;
                    const t = insight.tone ? toneUi[insight.tone] : null;
                    return (
                      <Card key={o.id} className={cx("flex flex-col p-5", insight.relevant && "border-accent/30")}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {insight.relevant && <Badge tone="accent">Seus programas</Badge>}
                          {o.bonusPct && <Badge tone="good">{formatDecimal(Number(o.bonusPct))}% de bônus</Badge>}
                          {o.discountPct && <Badge tone="good">{formatDecimal(Number(o.discountPct))}% de desconto</Badge>}
                          <Badge tone={days != null && days <= 2 ? "warning" : "neutral"}>
                            {o.endsOn ? `Até ${formatDate(o.endsOn)}${days != null ? ` (${days === 0 ? "termina hoje" : `${days} dia(s)`})` : ""}` : "Término não informado"}
                          </Badge>
                        </div>
                        <p className="mt-3 text-base font-semibold">{o.title}</p>
                        {o.kind !== "transferencia" && (o.toName || o.fromName) && (
                          <p className="mt-1 text-sm text-ink-2">{o.toName ?? o.fromName}</p>
                        )}
                        {o.kind === "transferencia" && (o.fromName || o.toName) && (
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                            {o.fromName ?? "—"}
                            {o.toName && (
                              <>
                                <ArrowRight className="size-3.5" aria-hidden /> {o.toName}
                              </>
                            )}
                            {o.ratioFrom && o.ratioTo && (
                              <span className="text-muted">
                                · paridade {formatDecimal(Number(o.ratioFrom))}:{formatDecimal(Number(o.ratioTo))}
                              </span>
                            )}
                          </p>
                        )}
                        {insight.lines.length > 0 && (
                          <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
                            {t && (
                              <p className={cx("mb-1 flex items-center gap-1.5 text-xs font-medium", t.color)}>
                                <t.icon className="size-3.5" aria-hidden /> {t.label}
                              </p>
                            )}
                            {insight.lines.map((l) => (
                              <p key={l}>{l}</p>
                            ))}
                          </div>
                        )}
                        {o.conditions && <p className="mt-3 text-xs text-ink-2">{o.conditions}</p>}
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                          <a
                            href={o.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            Fonte: {o.sourceName ?? new URL(o.sourceUrl).hostname} <ExternalLink className="size-3" aria-hidden />
                          </a>
                          <AskAgent
                            question={`Encontrei esta promoção no radar: "${o.title}"${o.bonusPct ? ` (${formatDecimal(Number(o.bonusPct))}% de bônus)` : ""}${o.endsOn ? `, válida até ${formatDate(o.endsOn)}` : ""}. Vale a pena aproveitar com os meus saldos? Quanto devo transferir ou comprar?`}
                          />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Resultados encontrados por IA. Antes de transferir ou comprar, confirme as condições no site oficial do programa: transferências costumam ser
        irreversíveis.
      </p>
    </>
  );
}
