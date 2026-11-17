import "server-only";
import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { addDaysISO, todayISO } from "@/lib/dates";
import { matchesAlert, type AlertCriteria, type DealLite } from "@/lib/flight-alerts";
import type { Place } from "@/lib/airports";

export type RouteAlert = typeof schema.routeAlerts.$inferSelect;
export type FlightDeal = typeof schema.flightDeals.$inferSelect;

const num = (v: string | null) => (v == null ? null : Number(v));

export function criteriaOf(a: RouteAlert): AlertCriteria {
  return {
    originCodes: a.originCodes,
    destinationCodes: a.destinationCodes,
    dateMode: a.dateMode,
    month: a.month,
    dateFrom: a.dateFrom,
    dateTo: a.dateTo,
    cabin: a.cabin,
    pay: a.pay,
    maxMiles: a.maxMiles,
    maxCashBrl: num(a.maxCashBrl),
  };
}

export function dealLite(d: FlightDeal): DealLite {
  return {
    origin: d.origin,
    destination: d.destination,
    kind: d.kind,
    // O teto do aviso é por trecho: alertas de ida e volta entram pela metade (aproximação).
    miles: d.miles == null ? null : d.roundTrip ? Math.round(d.miles / 2) : d.miles,
    cashBrl: num(d.cashBrl) == null ? null : d.roundTrip ? Number(d.cashBrl) / 2 : Number(d.cashBrl),
    cabin: d.cabin,
    dateFrom: d.dateFrom,
    dateTo: d.dateTo,
  };
}

export const placesOf = (v: unknown) => (Array.isArray(v) ? (v as Place[]) : []);

export async function listRouteAlerts(userId: string) {
  const alerts = await db
    .select()
    .from(schema.routeAlerts)
    .where(eq(schema.routeAlerts.userId, userId))
    .orderBy(desc(schema.routeAlerts.createdAt));
  const counts = await db
    .select({
      alertId: schema.routeAlertHits.alertId,
      total: sql<number>`count(*)::int`,
      unseen: sql<number>`count(*) filter (where ${schema.routeAlertHits.seenAt} is null)::int`,
    })
    .from(schema.routeAlertHits)
    .where(eq(schema.routeAlertHits.userId, userId))
    .groupBy(schema.routeAlertHits.alertId);
  const byId = new Map(counts.map((c) => [c.alertId, c]));
  return alerts.map((a) => ({ ...a, hits: byId.get(a.id)?.total ?? 0, unseen: byId.get(a.id)?.unseen ?? 0 }));
}

/** Voos ainda úteis (embarque não passou), mais recentes primeiro. */
export async function listDeals(userId: string, days = 30, limit = 80) {
  const today = todayISO();
  const since = addDaysISO(today, -days);
  return db
    .select()
    .from(schema.flightDeals)
    .where(
      and(
        eq(schema.flightDeals.userId, userId),
        gte(schema.flightDeals.createdAt, sql`${since}::date`),
        or(isNull(schema.flightDeals.dateTo), gte(schema.flightDeals.dateTo, today)),
      ),
    )
    .orderBy(desc(schema.flightDeals.createdAt))
    .limit(limit);
}

/** Voos dos últimos 30 dias, para "teria tocado N vezes" no formulário. */
export async function dealsForPreview(userId: string) {
  const since = addDaysISO(todayISO(), -30);
  const rows = await db
    .select()
    .from(schema.flightDeals)
    .where(and(eq(schema.flightDeals.userId, userId), gte(schema.flightDeals.createdAt, sql`${since}::date`)));
  return rows.map((d) => ({ ...dealLite(d), foundOn: todayISO(d.createdAt) }));
}

/** Ids dos avisos disparados por cada voo (para o selo no cartão). */
export async function hitsByDeal(userId: string) {
  const rows = await db
    .select({
      dealId: schema.routeAlertHits.dealId,
      alertId: schema.routeAlertHits.alertId,
      seenAt: schema.routeAlertHits.seenAt,
      fresh: sql<boolean>`${schema.routeAlertHits.createdAt} > now() - interval '24 hours'`,
    })
    .from(schema.routeAlertHits)
    .where(eq(schema.routeAlertHits.userId, userId));
  const out = new Map<string, { alertIds: string[]; unseen: boolean; fresh: boolean }>();
  for (const r of rows) {
    const cur = out.get(r.dealId) ?? { alertIds: [], unseen: false, fresh: false };
    cur.alertIds.push(r.alertId);
    cur.unseen ||= r.seenAt == null;
    cur.fresh ||= r.fresh;
    out.set(r.dealId, cur);
  }
  return out;
}

export async function unseenHitCount(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(distinct ${schema.routeAlertHits.dealId})::int` })
    .from(schema.routeAlertHits)
    .where(and(eq(schema.routeAlertHits.userId, userId), isNull(schema.routeAlertHits.seenAt)));
  return r?.n ?? 0;
}

export async function markHitsSeen(userId: string) {
  await db
    .update(schema.routeAlertHits)
    .set({ seenAt: new Date() })
    .where(and(eq(schema.routeAlertHits.userId, userId), isNull(schema.routeAlertHits.seenAt)));
}

/**
 * Registra os disparos: cada voo ainda útil que bate com um aviso ativo vira um "hit"
 * (uma vez por par aviso/voo). Usado depois de cada busca e ao criar ou editar um aviso.
 */
export async function recordHits(userId: string, opts: { alertIds?: string[]; dealIds?: string[] } = {}) {
  const today = todayISO();
  const alerts = await db
    .select()
    .from(schema.routeAlerts)
    .where(
      and(
        eq(schema.routeAlerts.userId, userId),
        eq(schema.routeAlerts.active, true),
        opts.alertIds?.length ? inArray(schema.routeAlerts.id, opts.alertIds) : undefined,
      ),
    );
  if (!alerts.length) return 0;
  const deals = opts.dealIds
    ? opts.dealIds.length
      ? await db.select().from(schema.flightDeals).where(and(eq(schema.flightDeals.userId, userId), inArray(schema.flightDeals.id, opts.dealIds)))
      : []
    : await listDeals(userId);
  const rows: { alertId: string; dealId: string; userId: string }[] = [];
  for (const a of alerts) {
    const c = criteriaOf(a);
    for (const d of deals) {
      if ((d.dateTo ?? d.dateFrom ?? today) < today) continue;
      if (matchesAlert(c, dealLite(d), today)) rows.push({ alertId: a.id, dealId: d.id, userId });
    }
  }
  if (!rows.length) return 0;
  const inserted = await db.insert(schema.routeAlertHits).values(rows).onConflictDoNothing().returning({ id: schema.routeAlertHits.id });
  return inserted.length;
}

/** Última busca (concluída ou não) para mostrar quando foi e quanto custou. */
export async function lastFlightRun(userId: string) {
  const [r] = await db
    .select()
    .from(schema.flightRuns)
    .where(eq(schema.flightRuns.userId, userId))
    .orderBy(desc(schema.flightRuns.startedAt))
    .limit(1);
  return r ?? null;
}
