import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

/** Início do mês corrente no fuso de Brasília. */
const monthStart = sql`date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'`;

export async function getAgentUsageSummary(userId: string) {
  const u = schema.agentUsage;
  const [month] = await db
    .select({
      usd: sql<string>`coalesce(sum(${u.costUsd}), 0)`,
      responses: sql<number>`count(*)::int`,
    })
    .from(u)
    .where(and(eq(u.userId, userId), gte(u.createdAt, monthStart)));
  const [all] = await db
    .select({ usd: sql<string>`coalesce(sum(${u.costUsd}), 0)` })
    .from(u)
    .where(eq(u.userId, userId));
  const perConversation = await db
    .select({ conversationId: u.conversationId, usd: sql<string>`sum(${u.costUsd})` })
    .from(u)
    .where(and(eq(u.userId, userId), sql`${u.conversationId} is not null`))
    .groupBy(u.conversationId);
  return {
    monthUsd: Number(month?.usd ?? 0),
    monthResponses: month?.responses ?? 0,
    allTimeUsd: Number(all?.usd ?? 0),
    byConversation: new Map(perConversation.map((r) => [r.conversationId!, Number(r.usd)])),
  };
}
