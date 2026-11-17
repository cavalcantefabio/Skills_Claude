import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { env } from "@/server/env";
import { agentEnabled, getAnthropic } from "@/server/agent/client";
import { runFlightSearch } from "@/server/flights/run";
import { notifyFlightHits } from "@/server/push/send";
import { DomainError } from "@/server/services/errors";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  if (!env.CRON_SECRET) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Busca automática de voos, chamada pela agenda (GitHub Actions, 8h e 20h de Brasília).
 * Só roda para quem tem aviso ativo; cada pessoa tem no máximo FLIGHT_AUTO_SEARCHES_PER_DAY
 * buscas automáticas por dia, separadas do limite do botão. Avisa no celular os disparos novos.
 */
export async function POST(request: Request) {
  if (!env.CRON_SECRET) return Response.json({ error: "Busca automática desligada (CRON_SECRET não configurado)." }, { status: 503 });
  if (!authorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!agentEnabled()) return Response.json({ error: "API do Claude não configurada." }, { status: 503 });

  const users = await db
    .selectDistinct({ userId: schema.routeAlerts.userId })
    .from(schema.routeAlerts)
    .where(eq(schema.routeAlerts.active, true));
  const results = [];
  for (const { userId } of users) {
    try {
      const r = await runFlightSearch({ client: getAnthropic(), userId, dailyLimit: env.FLIGHT_AUTO_SEARCHES_PER_DAY, trigger: "automatica" });
      const push = await notifyFlightHits(userId, r.dealIds);
      results.push({ ok: true, found: r.found, hits: r.hits, notified: push.sent, costUsd: Number(r.costUsd.toFixed(4)) });
    } catch (e) {
      if (!(e instanceof DomainError)) console.error("cron flight search failed", e);
      results.push({ ok: false, error: e instanceof DomainError ? e.message : "falha na busca" });
    }
  }
  return Response.json({ users: users.length, results });
}
