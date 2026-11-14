"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { toActionError, type ActionState } from "@/server/services/errors";
import { fieldErrors, intPoints, isoDate, optIsoDate, optMoney, optText, optUuid, reqText, uuid } from "@/lib/validation";
import { todayISO } from "@/lib/dates";

const place = (label: string) =>
  z
    .string({ error: `Informe ${label}.` })
    .trim()
    .min(2, `Informe ${label}.`)
    .max(60)
    .transform((s) => (/^[a-z]{3}$/i.test(s) ? s.toUpperCase() : s));

const tripSchema = z
  .object({
    title: reqText("um nome para a viagem", 80),
    origin: place("o aeroporto de origem"),
    destination: place("o destino"),
    departDate: optIsoDate("a data de ida"),
    returnDate: optIsoDate("a data de volta"),
    tripType: z.enum(schema.tripType.enumValues),
    flexDays: intPoints("a flexibilidade", { min: 0, max: 30 }),
    passengers: intPoints("os passageiros", { min: 1, max: 9 }),
    cabin: z.enum(schema.cabinClass.enumValues),
    status: z.enum(schema.tripStatus.enumValues),
    budgetBrl: optMoney("o orçamento"),
    alertDaysBefore: intPoints("a antecedência do alerta", { min: 0, max: 365 }),
    watchPromotions: z.preprocess((v) => v === "on", z.boolean()),
    notes: optText(1000),
  })
  .refine((v) => !v.returnDate || !v.departDate || v.returnDate >= v.departDate, {
    path: ["returnDate"],
    message: "A volta deve ser depois da ida.",
  })
  .refine((v) => v.tripType === "ida" || !v.returnDate || v.departDate, { path: ["departDate"], message: "Informe a data de ida." });

export async function saveTrip(tripId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const accountIds = z.array(z.string().uuid()).max(50).safeParse(formData.getAll("accountIds"));
  if (!accountIds.success) return { ok: false, message: "Seleção de programas inválida." };
  const v = parsed.data;
  let id = tripId;
  try {
    await db.transaction(async (tx) => {
      const row = {
        title: v.title,
        origin: v.origin,
        destination: v.destination,
        departDate: v.departDate ?? null,
        returnDate: v.tripType === "ida" ? null : (v.returnDate ?? null),
        tripType: v.tripType,
        flexDays: v.flexDays,
        flexibleDates: v.flexDays > 0,
        passengers: v.passengers,
        cabin: v.cabin,
        status: v.status,
        budgetBrl: v.budgetBrl != null ? v.budgetBrl.toFixed(2) : null,
        alertDaysBefore: v.alertDaysBefore,
        watchPromotions: v.watchPromotions,
        notes: v.notes ?? null,
      };
      if (tripId) {
        const res = await tx
          .update(schema.trips)
          .set(row)
          .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, user.id)))
          .returning({ id: schema.trips.id });
        if (!res.length) throw new Error("trip not found");
      } else {
        const [t] = await tx.insert(schema.trips).values({ userId: user.id, ...row }).returning({ id: schema.trips.id });
        id = t.id;
      }
      // Programas considerados: só contas da própria pessoa.
      await tx.delete(schema.tripAccounts).where(eq(schema.tripAccounts.tripId, id!));
      if (accountIds.data.length) {
        const own = await tx
          .select({ id: schema.loyaltyAccounts.id })
          .from(schema.loyaltyAccounts)
          .where(and(eq(schema.loyaltyAccounts.userId, user.id), inArray(schema.loyaltyAccounts.id, accountIds.data)));
        if (own.length) await tx.insert(schema.tripAccounts).values(own.map((a) => ({ tripId: id!, accountId: a.id })));
      }
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/viagens");
  redirect(`/viagens/${id}`);
}

export async function deleteTrip(formData: FormData) {
  const user = await requireUser();
  const id = z.string().uuid().parse(formData.get("id"));
  await db.delete(schema.trips).where(and(eq(schema.trips.id, id), eq(schema.trips.userId, user.id)));
  revalidatePath("/viagens");
  redirect("/viagens");
}

/* ------------------------------------------------------------------ */
/* Cotações                                                            */
/* ------------------------------------------------------------------ */

const quoteSchema = z
  .object({
    kind: z.enum(schema.quoteKind.enumValues),
    certainty: z.enum(schema.quoteCertainty.enumValues),
    programId: optUuid,
    label: optText(80),
    milesPerPax: z.preprocess((v) => (v === "" ? undefined : v), intPoints("as milhas por passageiro").optional()),
    taxesPerPaxBrl: optMoney("as taxas por passageiro"),
    cashPerPaxBrl: optMoney("o preço por passageiro"),
    covers: z.enum(schema.tripType.enumValues),
    sourceUrl: z.preprocess(
      (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
      z
        .string()
        .trim()
        .url("Informe um link válido.")
        .max(500)
        .refine((u) => /^https?:\/\//i.test(u), "Use um link http(s).")
        .optional(),
    ),
    checkedOn: isoDate("a data da consulta"),
    notes: optText(300),
  })
  .refine((v) => v.kind !== "milhas" || v.programId, { path: ["programId"], message: "Escolha o programa." })
  .refine((v) => v.kind !== "milhas" || v.milesPerPax, { path: ["milesPerPax"], message: "Informe as milhas por passageiro." })
  .refine((v) => v.kind !== "dinheiro" || (v.cashPerPaxBrl != null && v.cashPerPaxBrl > 0), {
    path: ["cashPerPaxBrl"],
    message: "Informe o preço por passageiro.",
  })
  .refine((v) => v.checkedOn <= todayISO(), { path: ["checkedOn"], message: "A data não pode estar no futuro." })
  .refine((v) => v.certainty === "real" || v.sourceUrl, { path: ["sourceUrl"], message: "Estimativas precisam de um link de fonte." });

export async function addQuote(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const tid = uuid.safeParse(tripId);
  if (!tid.success) return { ok: false, message: "Viagem inválida." };
  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    const [trip] = await db
      .select({ id: schema.trips.id })
      .from(schema.trips)
      .where(and(eq(schema.trips.id, tid.data), eq(schema.trips.userId, user.id)));
    if (!trip) return { ok: false, message: "Viagem não encontrada." };
    if (v.kind === "milhas") {
      const [p] = await db
        .select({ id: schema.programs.id })
        .from(schema.programs)
        .where(and(eq(schema.programs.id, v.programId!), or(isNull(schema.programs.ownerUserId), eq(schema.programs.ownerUserId, user.id))));
      if (!p) return { ok: false, fieldErrors: { programId: ["Programa inválido."] } };
    }
    await db.insert(schema.tripQuotes).values({
      tripId: tid.data,
      userId: user.id,
      kind: v.kind,
      certainty: v.certainty,
      programId: v.kind === "milhas" ? v.programId! : null,
      label: v.label ?? null,
      milesPerPax: v.kind === "milhas" ? v.milesPerPax! : null,
      taxesPerPaxBrl: v.kind === "milhas" && v.taxesPerPaxBrl != null ? v.taxesPerPaxBrl.toFixed(2) : null,
      cashPerPaxBrl: v.kind === "dinheiro" ? v.cashPerPaxBrl!.toFixed(2) : null,
      covers: v.covers,
      sourceUrl: v.sourceUrl ?? null,
      checkedOn: v.checkedOn,
      notes: v.notes ?? null,
    });
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath(`/viagens/${tid.data}`);
  revalidatePath("/viagens");
  return { ok: true, message: "Cotação adicionada." };
}

export async function deleteQuote(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Cotação inválida." };
  const [q] = await db
    .delete(schema.tripQuotes)
    .where(and(eq(schema.tripQuotes.id, id.data), eq(schema.tripQuotes.userId, user.id)))
    .returning({ tripId: schema.tripQuotes.tripId });
  if (q) revalidatePath(`/viagens/${q.tripId}`);
  revalidatePath("/viagens");
  return { ok: true };
}

export async function researchTripAction(tripId: string): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const { agentEnabled, getAnthropic } = await import("@/server/agent/client");
  const { researchTrip } = await import("@/server/trips/research");
  const { env } = await import("@/server/env");
  const { DomainError } = await import("@/server/services/errors");
  const { formatUSD } = await import("@/lib/pricing");
  if (!agentEnabled()) return { ok: false, message: "A pesquisa usa a API do Claude, que não está configurada." };
  const id = z.string().uuid().safeParse(tripId);
  if (!id.success) return { ok: false, message: "Viagem inválida." };
  try {
    const r = await researchTrip({ client: getAnthropic(), userId: user.id, tripId: id.data, dailyLimit: env.TRIP_RESEARCH_DAILY_LIMIT });
    revalidatePath(`/viagens/${id.data}`);
    revalidatePath("/viagens");
    return {
      ok: true,
      message: `${r.found} referência(s) salva(s) como estimativa. Custo: ${formatUSD(r.costUsd)}. ${r.summary}`.trim(),
    };
  } catch (e) {
    if (e instanceof DomainError) return { ok: false, message: e.message };
    console.error("trip research failed", e);
    return { ok: false, message: "Não foi possível pesquisar agora. Tente novamente." };
  }
}
