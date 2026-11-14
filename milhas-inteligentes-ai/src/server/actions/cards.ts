"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { encrypt } from "@/server/crypto";
import { toActionError, type ActionState } from "@/server/services/errors";
import { fieldErrors, money, optInt, optMoney, optText, optUuid, reqText } from "@/lib/validation";

const cardSchema = z
  .object({
    issuer: reqText("o banco emissor", 80),
    name: reqText("o nome do cartão", 80),
    brand: z.enum(schema.cardBrand.enumValues, { error: "Escolha a bandeira." }),
    annualFeeBrl: money("a anuidade", { max: 100_000 }),
    pointsPerUsd: optMoney("a pontuação por dólar", { max: 100 }),
    pointsPerBrl: optMoney("a pontuação por real", { max: 100 }),
    programId: optUuid,
    benefits: optText(1000),
    creditLimit: optMoney("o limite", { max: 100_000_000 }),
    dueDay: optInt("o dia de vencimento", { min: 1, max: 31 }),
    notes: optText(1000),
  })
  .refine((v) => v.pointsPerUsd != null || v.pointsPerBrl != null, {
    path: ["pointsPerUsd"],
    message: "Informe a pontuação por dólar ou por real.",
  });

async function assertProgramVisible(userId: string, programId: string | undefined) {
  if (!programId) return;
  const [p] = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(
      and(
        eq(schema.programs.id, programId),
        or(isNull(schema.programs.ownerUserId), eq(schema.programs.ownerUserId, userId)),
      ),
    );
  if (!p) throw new Error("program not visible");
}

function toRow(v: z.infer<typeof cardSchema>) {
  return {
    issuer: v.issuer,
    name: v.name,
    brand: v.brand,
    annualFeeBrl: v.annualFeeBrl.toFixed(2),
    pointsPerUsd: v.pointsPerUsd != null ? v.pointsPerUsd.toFixed(2) : null,
    pointsPerBrl: v.pointsPerBrl != null ? v.pointsPerBrl.toFixed(2) : null,
    programId: v.programId ?? null,
    benefits: v.benefits ?? null,
    creditLimitEnc: v.creditLimit != null ? encrypt(String(v.creditLimit)) : null,
    dueDay: v.dueDay ?? null,
    notes: v.notes ?? null,
  };
}

export async function saveCard(cardId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = cardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  try {
    await assertProgramVisible(user.id, parsed.data.programId);
    if (cardId) {
      const res = await db
        .update(schema.cards)
        .set(toRow(parsed.data))
        .where(and(eq(schema.cards.id, cardId), eq(schema.cards.userId, user.id)))
        .returning({ id: schema.cards.id });
      if (!res.length) return { ok: false, message: "Cartão não encontrado." };
    } else {
      await db.insert(schema.cards).values({ userId: user.id, ...toRow(parsed.data) });
    }
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/cartoes");
  revalidatePath("/");
  redirect("/cartoes");
}

export async function deleteCard(formData: FormData) {
  const user = await requireUser();
  const id = z.string().uuid().parse(formData.get("id"));
  await db.delete(schema.cards).where(and(eq(schema.cards.id, id), eq(schema.cards.userId, user.id)));
  revalidatePath("/cartoes");
  revalidatePath("/");
  redirect("/cartoes");
}
