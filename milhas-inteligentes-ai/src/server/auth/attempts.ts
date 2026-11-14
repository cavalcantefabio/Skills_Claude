import "server-only";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";

/** Falhas permitidas por e-mail na janela (desde o último login bem-sucedido). */
export const EMAIL_MAX_FAILURES = 10;
/** Falhas permitidas por IP na janela (protege contra testar muitos e-mails). */
export const IP_MAX_FAILURES = 30;
export const WINDOW_MINUTES = 15;

/**
 * IP do cliente. Em hospedagens com proxy, o primeiro valor de X-Forwarded-For vem do
 * próprio navegador e pode ser forjado; usamos o cabeçalho do proxy de borda quando existe
 * (CF-Connecting-IP) ou o último valor da cadeia, que é o adicionado pelo proxy.
 * O limite por e-mail não depende do IP, então continua valendo mesmo se o IP for falso.
 */
export function clientIpFrom(headers: Headers) {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const chain = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain?.length) return chain[chain.length - 1];
  return headers.get("x-real-ip")?.trim() || "local";
}

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60_000);

/** Verifica se pode tentar; devolve em quantos minutos libera quando bloqueado. */
export async function loginAllowed(email: string, ip: string): Promise<{ allowed: true } | { allowed: false; retryInMinutes: number }> {
  const a = schema.loginAttempts;
  const since = windowStart();
  // Falhas por e-mail contam só depois do último sucesso.
  const [lastOk] = await db
    .select({ at: a.createdAt })
    .from(a)
    .where(and(eq(a.email, email), eq(a.success, true)))
    .orderBy(desc(a.createdAt))
    .limit(1);
  const emailSince = lastOk && lastOk.at > since ? lastOk.at : since;
  const failures = async (field: typeof a.email | typeof a.ip, value: string, from: Date) =>
    db
      .select({ n: sql<number>`count(*)::int`, oldest: sql<Date | null>`min(${a.createdAt})` })
      .from(a)
      .where(and(eq(field, value), eq(a.success, false), gt(a.createdAt, from)));
  const [[byEmail], [byIp]] = await Promise.all([failures(a.email, email, emailSince), failures(a.ip, ip, since)]);
  const blockedBy = byEmail.n >= EMAIL_MAX_FAILURES ? byEmail : byIp.n >= IP_MAX_FAILURES ? byIp : null;
  if (!blockedBy) return { allowed: true };
  const oldest = blockedBy.oldest ? new Date(blockedBy.oldest) : new Date();
  const freeAt = oldest.getTime() + WINDOW_MINUTES * 60_000;
  return { allowed: false, retryInMinutes: Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000)) };
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await db.insert(schema.loginAttempts).values({ email, ip, success });
  // Limpeza: tentativas antigas e sessões expiradas.
  await db.delete(schema.loginAttempts).where(lt(schema.loginAttempts.createdAt, sql`now() - interval '1 day'`));
  if (success) await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}
