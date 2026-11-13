"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { recordTransaction } from "@/server/services/ledger";
import { DomainError, toActionError, type ActionState } from "@/server/services/errors";
import { fieldErrors, optInt, optIsoDate, optMoney, optText, optUuid } from "@/lib/validation";
import { todayISO } from "@/lib/dates";

const clubFields = {
  clubName: optText(80),
  clubMonthlyCostBrl: optMoney("o custo da assinatura", { max: 100_000 }),
  clubMonthlyPoints: optInt("os pontos mensais do clube", { min: 0, max: 10_000_000 }),
  milheiroValueBrl: optMoney("o valor do milheiro", { max: 10_000 }),
  notes: optText(1000),
};

const createSchema = z
  .object({
    programId: optUuid,
    customName: optText(60),
    customKind: z.enum(schema.programKind.enumValues).optional(),
    customUnit: optText(20),
    initialBalance: optInt("o saldo atual", { min: 0 }),
    expiresAt: optIsoDate("a validade"),
    ...clubFields,
  })
  .refine((v) => v.programId || v.customName, { path: ["programId"], message: "Escolha um programa ou informe o nome." })
  .refine((v) => !(v.initialBalance && v.initialBalance > 0 && v.expiresAt && v.expiresAt < todayISO()), {
    path: ["expiresAt"],
    message: "A validade do saldo atual não pode estar no passado.",
  });

const updateSchema = z.object(clubFields);

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50) || "programa";

const clubRow = (v: z.infer<typeof updateSchema>) => ({
  clubName: v.clubName ?? null,
  clubMonthlyCostBrl: v.clubMonthlyCostBrl != null ? v.clubMonthlyCostBrl.toFixed(2) : null,
  clubMonthlyPoints: v.clubMonthlyPoints ?? null,
  milheiroValueBrl: v.milheiroValueBrl != null ? v.milheiroValueBrl.toFixed(2) : null,
  notes: v.notes ?? null,
});

export async function createAccount(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  let accountId: string;
  try {
    accountId = await db.transaction(async (tx) => {
      let programId = v.programId;
      if (!programId) {
        const [p] = await tx
          .insert(schema.programs)
          .values({
            slug: `${slugify(v.customName!)}-${Date.now().toString(36)}`,
            name: v.customName!,
            kind: v.customKind ?? "outro",
            unit: v.customUnit ?? "pontos",
            ownerUserId: user.id,
          })
          .returning({ id: schema.programs.id });
        programId = p.id;
      } else {
        const [p] = await tx
          .select({ id: schema.programs.id })
          .from(schema.programs)
          .where(
            and(
              eq(schema.programs.id, programId),
              or(isNull(schema.programs.ownerUserId), eq(schema.programs.ownerUserId, user.id)),
            ),
          );
        if (!p) throw new DomainError("Programa inválido.");
      }
      const existing = await tx
        .select({ id: schema.loyaltyAccounts.id })
        .from(schema.loyaltyAccounts)
        .where(and(eq(schema.loyaltyAccounts.userId, user.id), eq(schema.loyaltyAccounts.programId, programId)));
      if (existing.length) throw new DomainError("Este programa já está cadastrado.");

      const [acc] = await tx
        .insert(schema.loyaltyAccounts)
        .values({ userId: user.id, programId, ...clubRow(v) })
        .returning({ id: schema.loyaltyAccounts.id });

      if (v.initialBalance && v.initialBalance > 0) {
        await recordTransaction(tx, {
          userId: user.id,
          accountId: acc.id,
          type: "saldo_inicial",
          points: v.initialBalance,
          occurredOn: todayISO(),
          expiresAt: v.expiresAt ?? null,
          description: "Saldo informado no cadastro",
        });
      }
      return acc.id;
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/", "layout");
  redirect(`/programas/${accountId}`);
}

export async function updateAccount(accountId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const res = await db
    .update(schema.loyaltyAccounts)
    .set(clubRow(parsed.data))
    .where(and(eq(schema.loyaltyAccounts.id, accountId), eq(schema.loyaltyAccounts.userId, user.id)))
    .returning({ id: schema.loyaltyAccounts.id });
  if (!res.length) return { ok: false, message: "Programa não encontrado." };
  revalidatePath("/", "layout");
  return { ok: true, message: "Alterações salvas." };
}

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const id = z.string().uuid().parse(formData.get("id"));
  await db.transaction(async (tx) => {
    const [acc] = await tx
      .delete(schema.loyaltyAccounts)
      .where(and(eq(schema.loyaltyAccounts.id, id), eq(schema.loyaltyAccounts.userId, user.id)))
      .returning({ programId: schema.loyaltyAccounts.programId });
    // Programa personalizado é exclusivo da conta: sai junto (cartões e viagens ficam sem vínculo).
    if (acc) {
      await tx
        .delete(schema.programs)
        .where(and(eq(schema.programs.id, acc.programId), eq(schema.programs.ownerUserId, user.id)));
    }
  });
  revalidatePath("/", "layout");
  redirect("/programas");
}
