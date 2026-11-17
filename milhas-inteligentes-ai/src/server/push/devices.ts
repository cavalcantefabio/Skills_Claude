import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

export async function countDevices(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.userId, userId));
  return r?.n ?? 0;
}
