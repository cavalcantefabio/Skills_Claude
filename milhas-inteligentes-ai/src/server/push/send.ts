import "server-only";
import webpush, { WebPushError } from "web-push";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decrypt, encrypt } from "@/server/crypto";
import { env } from "@/server/env";
import { dealHeadline } from "@/lib/flight-deal";

/**
 * Chaves VAPID do app: geradas uma vez e guardadas cifradas no banco (nenhuma
 * configuração manual). A pública vai para o navegador; a privada nunca sai do servidor.
 */
export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const read = async () => {
    const [row] = await db.select().from(schema.appSecrets).where(eq(schema.appSecrets.key, "vapid"));
    return row ? (JSON.parse(decrypt(row.value)) as { publicKey: string; privateKey: string }) : null;
  };
  const existing = await read();
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  // Duas instâncias ao mesmo tempo: vale a primeira gravada.
  await db.insert(schema.appSecrets).values({ key: "vapid", value: encrypt(JSON.stringify(keys)) }).onConflictDoNothing();
  return (await read())!;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Envia a todos os aparelhos da pessoa. Inscrições vencidas (404/410) são apagadas. */
export async function sendPush(userId: string, payload: PushPayload) {
  const subs = await db.select().from(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, userId));
  if (!subs.length) return { sent: 0, devices: 0 };
  const { publicKey, privateKey } = await vapidKeys();
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { vapidDetails: { subject: env.VAPID_SUBJECT, publicKey, privateKey }, TTL: 12 * 3600, urgency: "normal", timeout: 15_000 },
        );
        sent++;
        await db.update(schema.pushSubscriptions).set({ lastSuccessAt: new Date(), failures: 0 }).where(eq(schema.pushSubscriptions.id, s.id));
      } catch (e) {
        const gone = e instanceof WebPushError && (e.statusCode === 404 || e.statusCode === 410);
        if (gone || s.failures >= 4) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
        } else {
          await db
            .update(schema.pushSubscriptions)
            .set({ failures: sql`${schema.pushSubscriptions.failures} + 1` })
            .where(eq(schema.pushSubscriptions.id, s.id));
        }
        if (!gone) console.error("push failed", e instanceof WebPushError ? e.statusCode : e);
      }
    }),
  );
  return { sent, devices: subs.length };
}

/** Notificação dos voos novos que dispararam avisos (uma por busca, com o melhor resumo). */
export async function notifyFlightHits(userId: string, dealIds: string[]) {
  if (!dealIds.length) return { sent: 0, devices: 0, deals: 0 };
  const rows = await db
    .selectDistinct({ deal: schema.flightDeals })
    .from(schema.routeAlertHits)
    .innerJoin(schema.flightDeals, eq(schema.flightDeals.id, schema.routeAlertHits.dealId))
    .where(and(eq(schema.routeAlertHits.userId, userId), inArray(schema.routeAlertHits.dealId, dealIds)));
  if (!rows.length) return { sent: 0, devices: 0, deals: 0 };
  const deals = rows.map((r) => r.deal).sort((a, b) => (a.miles ?? Infinity) - (b.miles ?? Infinity));
  const first = dealHeadline(deals[0]);
  const payload: PushPayload =
    deals.length === 1
      ? { title: "Voo para o seu aviso", body: `${first.route}: ${first.price}${first.when ? ` (${first.when})` : ""}`, url: "/voos", tag: "voos" }
      : {
          title: `${deals.length} voos para os seus avisos`,
          body: `${first.route}: ${first.price}${first.when ? ` (${first.when})` : ""} e mais ${deals.length - 1}.`,
          url: "/voos",
          tag: "voos",
        };
  return { ...(await sendPush(userId, payload)), deals: deals.length };
}
