import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";

export async function listTransactions(userId: string, opts: { accountId?: string; limit?: number } = {}) {
  const t = schema.transactions;
  const rows = await db
    .select({
      id: t.id,
      accountId: t.accountId,
      programName: schema.programs.name,
      unit: schema.programs.unit,
      type: t.type,
      points: t.points,
      occurredOn: t.occurredOn,
      expiresAt: t.expiresAt,
      costBrl: t.costBrl,
      savingsBrl: t.savingsBrl,
      description: t.description,
      transferGroupId: t.transferGroupId,
      cardName: schema.cards.name,
      cardIssuer: schema.cards.issuer,
    })
    .from(t)
    .innerJoin(schema.loyaltyAccounts, eq(schema.loyaltyAccounts.id, t.accountId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.loyaltyAccounts.programId))
    .leftJoin(schema.cards, eq(schema.cards.id, t.cardId))
    .where(opts.accountId ? and(eq(t.userId, userId), eq(t.accountId, opts.accountId)) : eq(t.userId, userId))
    .orderBy(desc(t.occurredOn), desc(t.createdAt))
    .limit(opts.limit ?? 200);
  return rows.map((r) => ({
    ...r,
    costBrl: r.costBrl == null ? null : Number(r.costBrl),
    savingsBrl: r.savingsBrl == null ? null : Number(r.savingsBrl),
  }));
}

export type TxView = Awaited<ReturnType<typeof listTransactions>>[number];
