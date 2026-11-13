import "server-only";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { addDaysISO, todayISO } from "@/lib/dates";

export type AccountSummary = {
  id: string;
  programId: string;
  programName: string;
  programSlug: string;
  unit: string;
  kind: string;
  balance: number;
  milheiroValueBrl: number | null;
  /** Valor estimado em R$ (null quando o usuário não informou o valor do milheiro). */
  estimatedValueBrl: number | null;
  clubName: string | null;
  clubMonthlyCostBrl: number | null;
  clubMonthlyPoints: number | null;
  notes: string | null;
  /** Pontos que vencem dentro da janela de alerta do usuário. */
  expiringSoon: number;
  nextExpiry: string | null;
  /** Pontos com validade vencida ainda não baixados (precisam de lançamento de expiração). */
  expiredNotWrittenOff: number;
};

const num = (v: string | null) => (v == null ? null : Number(v));

export async function listAccounts(userId: string, alertDays = 90): Promise<AccountSummary[]> {
  const today = todayISO();
  const limit = addDaysISO(today, alertDays);
  const b = schema.balances;
  const rows = await db
    .select({
      id: schema.loyaltyAccounts.id,
      programId: schema.programs.id,
      programName: schema.programs.name,
      programSlug: schema.programs.slug,
      unit: schema.programs.unit,
      kind: schema.programs.kind,
      milheiroValueBrl: schema.loyaltyAccounts.milheiroValueBrl,
      clubName: schema.loyaltyAccounts.clubName,
      clubMonthlyCostBrl: schema.loyaltyAccounts.clubMonthlyCostBrl,
      clubMonthlyPoints: schema.loyaltyAccounts.clubMonthlyPoints,
      notes: schema.loyaltyAccounts.notes,
      balance: sql<number>`coalesce(sum(${b.remaining}), 0)::int`,
      expiringSoon: sql<number>`coalesce(sum(${b.remaining}) filter (where ${b.expiresAt} >= ${today} and ${b.expiresAt} <= ${limit}), 0)::int`,
      expired: sql<number>`coalesce(sum(${b.remaining}) filter (where ${b.expiresAt} < ${today}), 0)::int`,
      nextExpiry: sql<string | null>`min(${b.expiresAt}) filter (where ${b.expiresAt} >= ${today} and ${b.remaining} > 0)`,
    })
    .from(schema.loyaltyAccounts)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.loyaltyAccounts.programId))
    .leftJoin(b, eq(b.accountId, schema.loyaltyAccounts.id))
    .where(eq(schema.loyaltyAccounts.userId, userId))
    .groupBy(schema.loyaltyAccounts.id, schema.programs.id)
    .orderBy(asc(schema.programs.name));

  return rows.map((r) => {
    const milheiro = num(r.milheiroValueBrl);
    return {
      id: r.id,
      programId: r.programId,
      programName: r.programName,
      programSlug: r.programSlug,
      unit: r.unit,
      kind: r.kind,
      balance: r.balance,
      milheiroValueBrl: milheiro,
      estimatedValueBrl: milheiro == null ? null : (r.balance / 1000) * milheiro,
      clubName: r.clubName,
      clubMonthlyCostBrl: num(r.clubMonthlyCostBrl),
      clubMonthlyPoints: r.clubMonthlyPoints,
      notes: r.notes,
      expiringSoon: r.expiringSoon,
      nextExpiry: r.nextExpiry,
      expiredNotWrittenOff: r.expired,
    };
  });
}

/** Programas que o usuário pode escolher: os do sistema + os que ele criou. */
export async function listSelectablePrograms(userId: string) {
  return db
    .select({
      id: schema.programs.id,
      name: schema.programs.name,
      kind: schema.programs.kind,
      unit: schema.programs.unit,
      custom: sql<boolean>`${schema.programs.ownerUserId} is not null`,
    })
    .from(schema.programs)
    .where(or(isNull(schema.programs.ownerUserId), eq(schema.programs.ownerUserId, userId)))
    .orderBy(asc(schema.programs.kind), asc(schema.programs.name));
}

/** Lotes de saldo com pontos restantes (para a página Minhas Milhas e Alertas). */
export async function listLots(userId: string) {
  return db
    .select({
      id: schema.balances.id,
      accountId: schema.balances.accountId,
      programName: schema.programs.name,
      unit: schema.programs.unit,
      original: schema.balances.original,
      remaining: schema.balances.remaining,
      expiresAt: schema.balances.expiresAt,
    })
    .from(schema.balances)
    .innerJoin(schema.loyaltyAccounts, eq(schema.loyaltyAccounts.id, schema.balances.accountId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.loyaltyAccounts.programId))
    .where(and(eq(schema.loyaltyAccounts.userId, userId), gt(schema.balances.remaining, 0)))
    .orderBy(sql`${schema.balances.expiresAt} asc nulls last`);
}
