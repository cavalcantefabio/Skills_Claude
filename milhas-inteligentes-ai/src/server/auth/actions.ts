"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { createSession, destroySession } from "./session";
import { hashPassword, verifyPassword } from "./password";
import { rateLimit } from "./rate-limit";
import { clientIpFrom, loginAllowed, recordLoginAttempt } from "./attempts";
import type { ActionState } from "@/server/services/errors";
import { signupOpen } from "./signup";

const email = z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254);

const signupSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(80),
  email,
  password: z
    .string()
    .min(10, "Use ao menos 10 caracteres.")
    .max(128)
    .regex(/[A-Za-z]/, "Inclua ao menos uma letra.")
    .regex(/\d/, "Inclua ao menos um número."),
});

const DUMMY_HASH = "$2b$12$NVYs3.jxuVDkJJ2ZsutuU.D0zRxBdRPG7PX5fUAnT0KD8RasP4Mkm";

const loginSchema = z.object({ email, password: z.string().min(1, "Informe a senha.").max(128) });

async function clientKey(prefix: string, mail: string) {
  return `${prefix}:${clientIpFrom(await headers())}:${mail}`;
}

export async function signup(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { name, password } = parsed.data;
  if (!(await signupOpen())) return { ok: false, message: "O cadastro de novas contas está fechado." };
  if (!rateLimit(await clientKey("signup", "*"), 10)) {
    return { ok: false, message: "Muitas tentativas. Aguarde alguns minutos." };
  }

  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${parsed.data.email}`);
  if (existing.length) return { ok: false, fieldErrors: { email: ["Já existe uma conta com este e-mail."] } };

  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    // Serializa cadastros para que duas "primeiras contas" simultâneas não passem juntas.
    await tx.execute(sql`select pg_advisory_xact_lock(7316001)`);
    if (!(await signupOpen(tx))) return null;
    const [u] = await tx
      .insert(schema.users)
      .values({ email: parsed.data.email, passwordHash })
      .returning({ id: schema.users.id });
    await tx.insert(schema.profiles).values({ userId: u.id, name });
    return u.id;
  });
  if (!userId) return { ok: false, message: "O cadastro de novas contas está fechado." };
  await createSession(userId);
  redirect("/");
}

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const ip = clientIpFrom(await headers());
  const gate = await loginAllowed(parsed.data.email, ip);
  if (!gate.allowed) {
    return { ok: false, message: `Muitas tentativas de login. Tente de novo em ${gate.retryInMinutes} minuto(s).` };
  }

  const [user] = await db
    .select({ id: schema.users.id, hash: schema.users.passwordHash })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${parsed.data.email}`);
  // Mensagem genérica: não revela se o e-mail existe.
  // Sem usuário, compara contra um hash fictício para não revelar a existência do e-mail pelo tempo de resposta.
  const ok = await verifyPassword(parsed.data.password, user?.hash ?? DUMMY_HASH);
  await recordLoginAttempt(parsed.data.email, ip, Boolean(user && ok));
  if (!user || !ok) return { ok: false, message: "E-mail ou senha incorretos." };

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
