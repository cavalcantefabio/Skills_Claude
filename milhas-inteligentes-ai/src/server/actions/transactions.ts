"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { CREDIT_TYPES, deleteTransaction, recordTransaction, transferPoints } from "@/server/services/ledger";
import { toActionError, type ActionState } from "@/server/services/errors";
import { fieldErrors, intPoints, isoDate, money, optIsoDate, optMoney, optText, optUuid, uuid } from "@/lib/validation";
import { todayISO } from "@/lib/dates";

const LAUNCH_TYPES = schema.transactionType.enumValues.filter((t) => !t.startsWith("transferencia") && t !== "saldo_inicial");

const txSchema = z
  .object({
    accountId: uuid,
    type: z.enum(LAUNCH_TYPES as [string, ...string[]], { error: "Escolha o tipo." }),
    direction: z.enum(["entrada", "saida"]).optional(),
    points: intPoints("os pontos"),
    occurredOn: isoDate("a data"),
    expiresAt: optIsoDate("a validade"),
    cardId: optUuid,
    costBrl: optMoney("o custo"),
    savingsBrl: optMoney("a economia", { min: -10_000_000 }),
    description: optText(200),
  })
  .refine((v) => v.occurredOn <= todayISO(), { path: ["occurredOn"], message: "A data não pode estar no futuro." })
  .refine((v) => !v.expiresAt || v.expiresAt >= v.occurredOn, { path: ["expiresAt"], message: "A validade deve ser posterior à data." });

export async function createTx(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = txSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const type = v.type as (typeof schema.transactionType.enumValues)[number];
  const isCredit = CREDIT_TYPES.includes(type) || (type === "ajuste" && v.direction !== "saida");
  try {
    await db.transaction((tx) =>
      recordTransaction(tx, {
        userId: user.id,
        accountId: v.accountId,
        type,
        points: isCredit ? v.points : -v.points,
        occurredOn: v.occurredOn,
        expiresAt: isCredit ? (v.expiresAt ?? null) : null,
        cardId: type === "acumulo" ? (v.cardId ?? null) : null,
        costBrl: v.costBrl ?? null,
        savingsBrl: type === "resgate" ? (v.savingsBrl ?? null) : null,
        description: v.description ?? null,
      }),
    );
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Movimentação registrada." };
}

const transferSchema = z
  .object({
    fromAccountId: uuid,
    toAccountId: uuid,
    points: intPoints("os pontos"),
    ratioFrom: money("a paridade de origem", { max: 10_000 }).refine((n) => n > 0, "Deve ser maior que zero."),
    ratioTo: money("a paridade de destino", { max: 10_000 }).refine((n) => n > 0, "Deve ser maior que zero."),
    bonusPct: money("o bônus", { max: 1000 }),
    occurredOn: isoDate("a data"),
    expiresAt: optIsoDate("a validade"),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { path: ["toAccountId"], message: "Escolha um destino diferente da origem." })
  .refine((v) => v.occurredOn <= todayISO(), { path: ["occurredOn"], message: "A data não pode estar no futuro." });

export async function createTransfer(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = transferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const { received } = await transferPoints({
      userId: user.id,
      fromAccountId: v.fromAccountId,
      toAccountId: v.toAccountId,
      points: v.points,
      ratio: v.ratioTo / v.ratioFrom,
      bonusPct: v.bonusPct,
      occurredOn: v.occurredOn,
      expiresAt: v.expiresAt ?? null,
      description: `Paridade ${v.ratioFrom.toLocaleString("pt-BR")}:${v.ratioTo.toLocaleString("pt-BR")} com bônus de ${v.bonusPct.toLocaleString("pt-BR")}%`,
    });
    revalidatePath("/", "layout");
    return { ok: true, message: `Transferência registrada: ${received.toLocaleString("pt-BR")} recebidos no destino.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteTx(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Movimentação inválida." };
  try {
    await deleteTransaction(user.id, id.data);
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
