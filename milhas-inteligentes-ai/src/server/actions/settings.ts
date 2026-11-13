"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { createSession, destroySession, requireUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { rateLimit } from "@/server/auth/rate-limit";
import type { ActionState } from "@/server/services/errors";
import { fieldErrors, intPoints, money, reqText } from "@/lib/validation";

const profileSchema = z.object({
  name: reqText("seu nome", 80),
  usdRateBrl: money("a cotação do dólar", { max: 100 }).refine((n) => n > 0, "Deve ser maior que zero."),
  expiryAlertDays: intPoints("a janela de alerta", { min: 1, max: 365 }),
});

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  await db
    .update(schema.profiles)
    .set({ name: parsed.data.name, usdRateBrl: parsed.data.usdRateBrl.toFixed(4), expiryAlertDays: parsed.data.expiryAlertDays })
    .where(eq(schema.profiles.userId, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Preferências salvas." };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Informe a senha atual.").max(128),
    next: z
      .string()
      .min(10, "Use ao menos 10 caracteres.")
      .max(128)
      .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
      .regex(/\d/, "Inclua ao menos um número."),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "As senhas não conferem." });

/** Troca a senha e encerra todas as outras sessões. */
export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  if (!rateLimit(`pwd:${user.id}`, 5)) return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." };
  const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id));
  if (!row || !(await verifyPassword(parsed.data.current, row.hash))) {
    return { ok: false, fieldErrors: { current: ["Senha atual incorreta."] } };
  }
  await db.update(schema.users).set({ passwordHash: await hashPassword(parsed.data.next) }).where(eq(schema.users.id, user.id));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await createSession(user.id);
  return { ok: true, message: "Senha alterada. As outras sessões foram encerradas." };
}

export async function logoutEverywhere() {
  const user = await requireUser();
  await destroySession();
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  redirect("/login");
}
