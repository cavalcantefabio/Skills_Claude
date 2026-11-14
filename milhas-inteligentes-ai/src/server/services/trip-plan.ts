import "server-only";
import { and, asc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { listAccounts, type AccountSummary } from "@/server/services/accounts";
import { latestRadar } from "@/server/radar/run";
import { buildTripPlan, type PlanAccount, type PlanPromo, type QuoteLite, type TripPlan } from "@/lib/travel-plan";
import { addDaysISO, monthEnd, monthRange, todayISO } from "@/lib/dates";
import { monthlyBalances } from "@/lib/series";

const n = (v: string | null) => (v == null ? null : Number(v));
const ACCRUAL_MONTHS = 6;

export type TripRow = typeof schema.trips.$inferSelect;

/** Média mensal de acúmulos e bônus por conta nos últimos 6 meses completos. */
async function monthlyAccruals(userId: string) {
  const today = todayISO();
  const months = monthRange(addDaysISO(`${today.slice(0, 7)}-01`, -1), ACCRUAL_MONTHS);
  const t = schema.transactions;
  const rows = await db
    .select({ accountId: t.accountId, total: sql<number>`coalesce(sum(${t.points}), 0)::int` })
    .from(t)
    .where(
      and(
        eq(t.userId, userId),
        inArray(t.type, ["acumulo", "bonus"]),
        gt(t.points, 0),
        gte(t.occurredOn, `${months[0]}-01`),
        lte(t.occurredOn, monthEnd(months[months.length - 1])),
      ),
    )
    .groupBy(t.accountId);
  return new Map(rows.map((r) => [r.accountId, r.total / ACCRUAL_MONTHS]));
}

/** Pontos que vencem entre hoje e a data limite, por conta. */
async function expiringUntil(userId: string, until: string) {
  const b = schema.balances;
  const rows = await db
    .select({ accountId: b.accountId, total: sql<number>`coalesce(sum(${b.remaining}), 0)::int` })
    .from(b)
    .innerJoin(schema.loyaltyAccounts, eq(schema.loyaltyAccounts.id, b.accountId))
    .where(and(eq(schema.loyaltyAccounts.userId, userId), gt(b.remaining, 0), gte(b.expiresAt, todayISO()), lte(b.expiresAt, until)))
    .groupBy(b.accountId);
  return new Map(rows.map((r) => [r.accountId, r.total]));
}

export async function currentPromos(userId: string): Promise<PlanPromo[]> {
  const radar = await latestRadar(userId);
  const today = todayISO();
  return (radar?.opportunities ?? [])
    .filter((o) => !o.endsOn || o.endsOn >= today)
    .map((o) => ({
      kind: o.kind,
      title: o.title,
      fromSlug: o.fromSlug,
      toSlug: o.toSlug,
      bonusPct: n(o.bonusPct),
      ratioFrom: n(o.ratioFrom),
      ratioTo: n(o.ratioTo),
      pricePerThousandBrl: n(o.pricePerThousandBrl),
      endsOn: o.endsOn,
    }));
}

export async function listTripQuotes(userId: string, tripIds: string[]) {
  if (!tripIds.length) return [];
  return db
    .select({ quote: schema.tripQuotes, programName: schema.programs.name, programSlug: schema.programs.slug })
    .from(schema.tripQuotes)
    .leftJoin(schema.programs, eq(schema.programs.id, schema.tripQuotes.programId))
    .where(and(eq(schema.tripQuotes.userId, userId), inArray(schema.tripQuotes.tripId, tripIds)))
    .orderBy(asc(schema.tripQuotes.createdAt));
}

const toQuoteLite = (q: typeof schema.tripQuotes.$inferSelect): QuoteLite => ({
  id: q.id,
  kind: q.kind,
  certainty: q.certainty,
  programId: q.programId,
  label: q.label,
  milesPerPax: q.milesPerPax,
  taxesPerPaxBrl: n(q.taxesPerPaxBrl),
  cashPerPaxBrl: n(q.cashPerPaxBrl),
  covers: q.covers,
  sourceUrl: q.sourceUrl,
  checkedOn: q.checkedOn,
});

export type TripWithPlan = {
  trip: TripRow;
  plan: TripPlan;
  quotes: Awaited<ReturnType<typeof listTripQuotes>>;
  consideredAccountIds: string[];
  accounts: AccountSummary[];
};

/** Plano de cada viagem da pessoa (ou de uma só), com dados reais do banco. */
export async function loadTripPlans(userId: string, tripId?: string): Promise<TripWithPlan[]> {
  const trips = await db
    .select()
    .from(schema.trips)
    .where(tripId ? and(eq(schema.trips.userId, userId), eq(schema.trips.id, tripId)) : eq(schema.trips.userId, userId))
    .orderBy(sql`${schema.trips.departDate} asc nulls last`, asc(schema.trips.createdAt));
  if (!trips.length) return [];

  const ids = trips.map((t) => t.id);
  const [accounts, accruals, promos, quotes, links] = await Promise.all([
    listAccounts(userId),
    monthlyAccruals(userId),
    currentPromos(userId),
    listTripQuotes(userId, ids),
    db.select().from(schema.tripAccounts).where(inArray(schema.tripAccounts.tripId, ids)),
  ]);
  const today = todayISO();

  const out: TripWithPlan[] = [];
  for (const trip of trips) {
    const linked = links.filter((l) => l.tripId === trip.id).map((l) => l.accountId);
    const considered = linked.length ? accounts.filter((a) => linked.includes(a.id)) : accounts;
    const expiring = trip.departDate ? await expiringUntil(userId, trip.departDate) : new Map<string, number>();
    const planAccounts: PlanAccount[] = considered.map((a) => ({
      id: a.id,
      programId: a.programId,
      programSlug: a.programSlug,
      programName: a.programName,
      kind: a.kind,
      unit: a.unit,
      balance: a.balance,
      milheiroValueBrl: a.milheiroValueBrl,
      monthlyAccrual: accruals.get(a.id) ?? 0,
      expiringBeforeTrip: expiring.get(a.id) ?? 0,
    }));
    const tripQuotes = quotes.filter((q) => q.quote.tripId === trip.id);
    const plan = buildTripPlan({
      trip: { passengers: trip.passengers, tripType: trip.tripType, departDate: trip.departDate, budgetBrl: n(trip.budgetBrl) },
      quotes: tripQuotes.map((q) => toQuoteLite(q.quote)),
      accounts: planAccounts,
      promos,
      today,
    });
    out.push({ trip, plan, quotes: tripQuotes, consideredAccountIds: linked, accounts: considered });
  }
  return out;
}

/**
 * Evolução do potencial da meta: saldo do programa da meta + pontos de banco (premissa 1:1),
 * ao fim de cada mês dos últimos 12 meses.
 */
export async function goalProgressSeries(userId: string, accountIds: string[]) {
  if (!accountIds.length) return [];
  const months = monthRange(todayISO(), 12);
  const t = schema.transactions;
  const txs = await db
    .select({ accountId: t.accountId, points: t.points, occurredOn: t.occurredOn })
    .from(t)
    .where(and(eq(t.userId, userId), inArray(t.accountId, accountIds)));
  return monthlyBalances(txs, months, accountIds).map((row) => ({
    month: String(row.month),
    value: accountIds.reduce((s, id) => s + Number(row[id] ?? 0), 0),
  }));
}
