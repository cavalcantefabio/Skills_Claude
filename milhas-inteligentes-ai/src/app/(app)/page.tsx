import type { Metadata } from "next";
import { Suspense } from "react";
import { BadgeDollarSign, CreditCard, PiggyBank, Plus, Wallet } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getDashboard, PERIODS, type PeriodKey } from "@/server/services/dashboard";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, StatTile, Table, td, th } from "@/components/ui";
import { ChartCard, ColumnChart, LineSeriesChart, RankedBars, type Series } from "@/components/charts/charts";
import { DashboardFilters } from "@/components/dashboard-filters";
import { formatBRL, formatDate, formatPoints, monthLabel } from "@/lib/format";
import { diffDays, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const user = await requireUser();
  const sp = await searchParams;
  const period = (typeof sp.periodo === "string" && sp.periodo in PERIODS ? sp.periodo : "12m") as PeriodKey;
  const accountParam = typeof sp.programa === "string" ? sp.programa : null;

  const data = await getDashboard(user.id, user.expiryAlertDays, { period, accountId: accountParam });
  const accountId = data.accounts.length === 1 && accountParam ? accountParam : null;
  const firstName = user.name.split(" ")[0];

  if (data.allAccounts.length === 0) {
    return (
      <>
        <PageHeader title={`Olá, ${firstName}`} description="Seu painel aparece aqui assim que você cadastrar o primeiro programa." />
        <Card>
          <EmptyState
            icon={Wallet}
            title="Nenhum programa de fidelidade cadastrado"
            description="Cadastre seus programas (Livelo, Smiles, LATAM Pass...) com o saldo atual e a validade dos pontos."
            action={
              <LinkButton href="/programas">
                <Plus className="size-4" aria-hidden /> Cadastrar programa
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  // Cor fixa por programa: posição na lista completa (não muda com filtros).
  const slotOf = new Map(data.allAccounts.map((a, i) => [a.id, i]));
  const series: Series[] = data.accounts.map((a) => ({
    key: a.id,
    name: a.programName,
    slot: slotOf.get(a.id)!,
    unit: a.unit,
  }));
  const single = data.accounts.length === 1 ? data.accounts[0] : null;
  const { kpis } = data;
  const today = todayISO();

  const valued = data.accounts
    .filter((a) => a.estimatedValueBrl != null && a.estimatedValueBrl > 0)
    .sort((a, b) => b.estimatedValueBrl! - a.estimatedValueBrl!);

  const movementSeries: Series[] = single
    ? [
        { key: "entradas", name: "Entradas", slot: 2, unit: single.unit },
        { key: "saidas", name: "Saídas", slot: 1, unit: single.unit },
      ]
    : [{ key: "count", name: "Movimentações", slot: 0 }];

  const periodLabel = `${PERIODS[period]} meses`;

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Visão consolidada dos seus programas. Saldos de programas diferentes nunca são somados entre si; só o valor estimado em reais é consolidado."
        actions={
          <Suspense>
            <DashboardFilters
              period={period}
              accountId={accountId}
              accounts={data.allAccounts.map((a) => ({ id: a.id, name: a.programName }))}
            />
          </Suspense>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Valor econômico estimado"
          icon={BadgeDollarSign}
          value={formatBRL(kpis.estimatedValueBrl)}
          sub={
            kpis.unvaluedCount > 0 ? (
              <span>
                {kpis.valuedCount} de {kpis.valuedCount + kpis.unvaluedCount} programas com valor do milheiro definido
              </span>
            ) : (
              "Com base no valor do milheiro que você definiu"
            )
          }
        />
        <StatTile
          label="Economia acumulada"
          icon={PiggyBank}
          value={formatBRL(kpis.savingsAllTime)}
          sub={`${formatBRL(kpis.savingsInPeriod)} em ${kpis.redemptionCount} resgate(s) nos últimos ${periodLabel}`}
        />
        <StatTile label="Programas cadastrados" icon={Wallet} value={kpis.programCount} sub="Bancos, companhias e hotéis" />
        <StatTile label="Cartões cadastrados" icon={CreditCard} value={kpis.cardCount} sub="Usados para atribuir acúmulos" />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Saldo por programa"
          description={`Pontos vencendo considera os próximos ${user.expiryAlertDays} dias. Acumulado no mês exclui transferências entre seus programas.`}
        />
        <CardBody>
          <Table>
            <thead>
              <tr>
                <th className={th}>Programa</th>
                <th className={`${th} text-right`}>Saldo</th>
                <th className={`${th} text-right`}>Valor estimado</th>
                <th className={`${th} text-right`}>Acumulado no mês</th>
                <th className={`${th} text-right`}>Vencendo</th>
                <th className={th}>Próxima validade</th>
              </tr>
            </thead>
            <tbody>
              {data.accruedThisMonth.map((a) => {
                const days = a.nextExpiry ? diffDays(today, a.nextExpiry) : null;
                return (
                  <tr key={a.id}>
                    <td className={td}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: `var(--series-${(slotOf.get(a.id)! % 8) + 1})` }}
                          aria-hidden
                        />
                        <span className="font-medium">{a.programName}</span>
                        {a.clubName && <Badge tone="accent">{a.clubName}</Badge>}
                      </div>
                    </td>
                    <td className={`${td} tabular text-right`}>
                      {formatPoints(a.balance)} <span className="text-muted">{a.unit}</span>
                    </td>
                    <td className={`${td} tabular text-right`}>
                      {a.estimatedValueBrl != null ? formatBRL(a.estimatedValueBrl) : <span className="text-muted">não definido</span>}
                    </td>
                    <td className={`${td} tabular text-right`}>{a.accrued > 0 ? `+${formatPoints(a.accrued)}` : "—"}</td>
                    <td className={`${td} tabular text-right`}>
                      {a.expiringSoon > 0 ? (
                        <Badge tone={days != null && days <= 30 ? "critical" : "warning"}>{formatPoints(a.expiringSoon)}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${td} text-ink-2`}>
                      {a.nextExpiry ? (
                        <>
                          {formatDate(a.nextExpiry)} <span className="text-muted">({days} dias)</span>
                        </>
                      ) : (
                        "—"
                      )}
                      {a.expiredNotWrittenOff > 0 && (
                        <span className="ml-2">
                          <Badge tone="critical">{formatPoints(a.expiredNotWrittenOff)} vencidos</Badge>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardBody>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Evolução mensal de pontos"
          description="Saldo ao fim de cada mês, uma linha por programa (unidades não são somadas)."
          legend={series}
          table={{
            columns: ["Mês", ...series.map((s) => s.name)],
            rows: data.evolution.map((r) => [monthLabel(String(r.month)), ...series.map((s) => formatPoints(Number(r[s.key])))]),
          }}
        >
          <LineSeriesChart data={data.evolution} series={series} />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Distribuição por programa"
          description="Participação no valor estimado em R$, a única medida comparável entre programas."
          empty={valued.length === 0 && "Defina o valor do milheiro dos seus programas para ver a distribuição."}
          table={{
            columns: ["Programa", "Saldo", "Valor estimado"],
            rows: valued.map((a) => [a.programName, `${formatPoints(a.balance)} ${a.unit}`, formatBRL(a.estimatedValueBrl!)]),
          }}
        >
          <div className="h-full overflow-y-auto pr-1">
            <RankedBars
              items={valued.map((a) => ({
                key: a.id,
                label: a.programName,
                sub: `${Math.round((a.estimatedValueBrl! / kpis.estimatedValueBrl) * 100)}%`,
                value: a.estimatedValueBrl!,
                display: formatBRL(a.estimatedValueBrl!),
                slot: slotOf.get(a.id)!,
              }))}
            />
          </div>
        </ChartCard>

        <ChartCard
          className="xl:col-span-3"
          title="Histórico de movimentações"
          description={
            single
              ? `Entradas e saídas de ${single.programName} por mês, em ${single.unit}.`
              : "Quantidade de movimentações por mês. Selecione um programa para ver entradas e saídas em pontos."
          }
          legend={movementSeries}
          table={{
            columns: ["Mês", ...movementSeries.map((s) => s.name)],
            rows: data.movementsByMonth.map((r) => [
              monthLabel(r.month),
              ...movementSeries.map((s) => formatPoints(Number(r[s.key as "entradas" | "saidas" | "count"]))),
            ]),
          }}
        >
          <ColumnChart
            data={data.movementsByMonth}
            series={movementSeries}
            kind={single ? "points" : "count"}
          />
        </ChartCard>

        <ChartCard
          className="xl:col-span-2"
          title="Acúmulo por cartão"
          description={`Pontos creditados com cartão vinculado, nos últimos ${periodLabel}.`}
          empty={
            data.accrualByCard.length === 0 &&
            "Nenhum acúmulo vinculado a cartão no período. Ao registrar um acúmulo em Minhas Milhas, escolha o cartão."
          }
          table={{
            columns: ["Cartão", "Programa", "Pontos"],
            rows: data.accrualByCard.map((c) => [`${c.issuer} ${c.cardName}`, c.programName, `${formatPoints(c.points)} ${c.unit}`]),
          }}
        >
          <div className="h-full overflow-y-auto pr-1">
            <RankedBars
              items={data.accrualByCard.map((c) => ({
                key: c.cardId,
                label: `${c.issuer} ${c.cardName}`,
                sub: c.programName,
                value: c.points,
                display: `${formatPoints(c.points)} ${c.unit}`,
                slot: 0,
              }))}
            />
          </div>
        </ChartCard>

        <ChartCard
          className="xl:col-span-5"
          title="Histórico de resgates"
          description="Economia por mês: preço em dinheiro evitado menos as taxas pagas na emissão."
          empty={
            kpis.redemptionCount === 0 &&
            "Nenhum resgate no período. Registre resgates em Minhas Milhas informando a economia obtida."
          }
          table={{
            columns: ["Mês", "Economia"],
            rows: data.redemptionsByMonth.map((r) => [monthLabel(r.month), formatBRL(r.value)]),
          }}
        >
          <ColumnChart
            data={data.redemptionsByMonth}
            series={[{ key: "value", name: "Economia", slot: 2 }]}
            kind="brl"
          />
        </ChartCard>
      </div>
    </>
  );
}
