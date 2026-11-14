import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";

/**
 * Cadastro aberto? App de uso pessoal: só enquanto não existe nenhuma conta,
 * a menos que ALLOW_SIGNUP=true.
 */
export async function signupOpen(executor: Pick<typeof db, "select"> = db) {
  if (env.ALLOW_SIGNUP) return true;
  const [r] = await executor.select({ n: sql<number>`count(*)::int` }).from(schema.users);
  return (r?.n ?? 0) === 0;
}
