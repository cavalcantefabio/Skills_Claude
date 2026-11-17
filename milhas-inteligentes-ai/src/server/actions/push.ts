"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { sendPush } from "@/server/push/send";

const subSchema = z.object({
  endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "Endereço inválido."),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Guarda a inscrição deste aparelho (o mesmo endpoint passa a ser desta pessoa). */
export async function savePushSubscription(sub: unknown, device: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const parsed = subSchema.safeParse(sub);
  if (!parsed.success) return { ok: false, message: "O navegador devolveu uma inscrição inválida." };
  const { endpoint, keys } = parsed.data;
  await db
    .insert(schema.pushSubscriptions)
    .values({ userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, device: device.slice(0, 60) || null })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, device: device.slice(0, 60) || null, failures: 0 },
    });
  return { ok: true, message: "Notificações ativadas neste aparelho." };
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  await db
    .delete(schema.pushSubscriptions)
    .where(and(eq(schema.pushSubscriptions.userId, user.id), eq(schema.pushSubscriptions.endpoint, endpoint)));
}

export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const r = await sendPush(user.id, {
    title: "Milhas Inteligentes",
    body: "Notificações funcionando. Você será avisado quando um voo bater com seus avisos.",
    url: "/voos",
    tag: "teste",
  });
  if (!r.devices) return { ok: false, message: "Nenhum aparelho com notificações ativadas." };
  return r.sent
    ? { ok: true, message: `Enviada para ${r.sent} de ${r.devices} aparelho(s). Pode levar alguns segundos.` }
    : { ok: false, message: "O serviço de notificações recusou o envio. Desative e ative de novo neste aparelho." };
}
