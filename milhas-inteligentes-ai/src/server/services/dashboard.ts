import "server-only";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { listAccounts } from "@/server/services/accounts";
import { CREDIT_TYPES } from "@/server/services/ledger";
import { monthEnd, monthOf, monthRange, todayISO } from "@/lib/dates";
import { bucketByMonth, monthlyBalances } from "@/lib/series";

export const PERIODS = { "3m": 3, "6m": 6, "12m": 12, "24m": 24 } as const;
export type PeriodKey = keyof typeof PERIODS;

export type DashboardFilters = { period: PeriodKey; accountId: string | null };

export async function getDashboard(userId: string, alertDays: number, filters: DashboardFilters) {
  const today = todayISO();
  const months = monthRange(today, PERIODS[filters.period]);
  const periodStart = `${months[0]}-01`;
  const periodEnd = monthEnd(months[months.length - 1]);

  const allAccounts = await listAccounts(userId, alertDays);
  const accounts = filters.accountId ? allAccounts.filter((a) => a.id === filters.accountId) : allAccounts;
  const accountIds = accounts.map((a) => a.id);

  const [cardCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.cards)
    .where(eq(schema.cards.userId, userId));

  const t = schema.transactions;
  const txs = accountIds.length
    ? await db
        .select({
          id: t.id,
          accountId: t.accountId,
          type: t.type,
          points: t.points,
          occurredOn: t.occurredOn,
          cardId: t.cardId,
          savingsBrl: t.savingsBrl,
        })
        .from(t)
        .where(and(eq(t.userId, userId), inArray(t.accountId, accountIds), lte(t.occurredOn, periodEnd)))
        .orderBy(asc(t.occurredOn))
    : [];

  const inPeriod = txs.filter((x) => x.occurredOn >= periodStart);
  const thisMonth = monthOf(today);
  const isAccrual = (type: string) => CREDIT_TYPES.includes(type as never) && type !== "saldo_inicial";

  // Indicadores por programa — nunca somamos programas diferentes.
  const accruedThisMonth = new Map<string, number>();
  for (const x of txs) {
    if (monthOf(x.occurredOn) === thisMonth && isAccrual(x.type) && x.type !== "transferencia_entrada") {
      accruedThisMonth.set(x.accountId, (accruedThisMonth.get(x.accountId) ?? 0) + x.points);
    }
  }

  const redemptions = txs.filter((x) => x.type === "resgate");
  const savingsAllTime = redemptions.reduce((s, x) => s + Number(x.savingsBrl ?? 0), 0);
  const savingsInPeriod = redemptions
    .filter((x) => x.occurredOn >= periodStart)
    .reduce((s, x) => s + Number(x.savingsBrl ?? 0), 0);

  const valued = accounts.filter((a) => a.estimatedValueBrl != null);
  const estimatedValueBrl = valued.reduce((s, a) => s + (a.estimatedValueBrl ?? 0), 0);

  // Séries
  const evolution = monthlyBalances(txs, months, accountIds);

  const movementsByMonth = months.map((m) => {
    const rows = inPeriod.filter((x) => monthOf(x.occurredOn) === m);
    return {
      month: m,
      entradas: rows.filter((x) => x.points > 0).reduce((s, x) => s + x.points, 0),
      saidas: rows.filter((x) => x.points < 0).reduce((s, x) => s - x.points, 0),
      count: rows.length,
    };
  });

  const redemptionsByMonth = bucketByMonth(
    redemptions.filter((x) => x.occurredOn >= periodStart),
    months,
    (x) => x.occurredOn,
    (x) => Number(x.savingsBrl ?? 0),
  );

  const cardRows = await db
    .select({
      cardId: schema.cards.id,
      cardName: schema.cards.name,
      issuer: schema.cards.issuer,
      programName: schema.programs.name,
      unit: schema.programs.unit,
      points: sql<number>`coalesce(sum(${t.points}), 0)::int`,
    })
    .from(schema.cards)
    .innerJoin(t, eq(t.cardId, schema.cards.id))
    .innerJoin(schema.loyaltyAccounts, eq(schema.loyaltyAccounts.id, t.accountId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.loyaltyAccounts.programId))
    .where(
      and(
        eq(schema.cards.userId, userId),
        gte(t.occurredOn, periodStart),
        lte(t.occurredOn, periodEnd),
        sql`${t.points} > 0`,
        accountIds.length ? inArray(t.accountId, accountIds) : sql`false`,
      ),
    )
    .groupBy(schema.cards.id, schema.programs.id)
    .orderBy(sql`4 desc`);

  return {
    months,
    accounts,
    allAccounts,
    kpis: {
      programCount: allAccounts.length,
      cardCount: cardCount?.n ?? 0,
      estimatedValueBrl,
      valuedCount: valued.length,
      unvaluedCount: accounts.length - valued.length,
      savingsAllTime,
      savingsInPeriod,
      redemptionCount: redemptions.filter((x) => x.occurredOn >= periodStart).length,
    },
    accruedThisMonth: accounts.map((a) => ({ ...a, accrued: accruedThisMonth.get(a.id) ?? 0 })),
    evolution,
    movementsByMonth,
    redemptionsByMonth,
    accrualByCard: cardRows,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
