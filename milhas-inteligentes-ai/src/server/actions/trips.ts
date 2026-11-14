"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { toActionError, type ActionState } from "@/server/services/errors";
import { fieldErrors, intPoints, optInt, optIsoDate, optMoney, optText, optUuid, reqText } from "@/lib/validation";

const iata = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `Informe ${label}.`)
    .max(60)
    .transform((s) => (/^[a-z]{3}$/i.test(s) ? s.toUpperCase() : s));

const tripSchema = z
  .object({
    title: reqText("um nome para a viagem", 80),
    origin: iata("a origem"),
    destination: iata("o destino"),
    departDate: optIsoDate("a data de ida"),
    returnDate: optIsoDate("a data de volta"),
    passengers: intPoints("os passageiros", { min: 1, max: 9 }),
    cabin: z.enum(schema.cabinClass.enumValues),
    status: z.enum(schema.tripStatus.enumValues),
    programId: optUuid,
    milesNeeded: optInt("as milhas necessárias"),
    cashPriceBrl: optMoney("o preço em dinheiro"),
    flexibleDates: z.preprocess((v) => v === "on", z.boolean()),
    notes: optText(1000),
  })
  .refine((v) => !v.returnDate || !v.departDate || v.returnDate >= v.departDate, {
    path: ["returnDate"],
    message: "A volta deve ser depois da ida.",
  });

export async function saveTrip(tripId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  try {
    if (v.programId) {
      const [p] = await db
        .select({ id: schema.programs.id })
        .from(schema.programs)
        .where(and(eq(schema.programs.id, v.programId), or(isNull(schema.programs.ownerUserId), eq(schema.programs.ownerUserId, user.id))));
      if (!p) return { ok: false, fieldErrors: { programId: ["Programa inválido."] } };
    }
    const row = {
      ...v,
      departDate: v.departDate ?? null,
      returnDate: v.returnDate ?? null,
      programId: v.programId ?? null,
      milesNeeded: v.milesNeeded ?? null,
      cashPriceBrl: v.cashPriceBrl != null ? v.cashPriceBrl.toFixed(2) : null,
      notes: v.notes ?? null,
    };
    if (tripId) {
      const res = await db
        .update(schema.trips)
        .set(row)
        .where(and(eq(schema.trips.id, tripId), eq(schema.trips.userId, user.id)))
        .returning({ id: schema.trips.id });
      if (!res.length) return { ok: false, message: "Viagem não encontrada." };
    } else {
      await db.insert(schema.trips).values({ userId: user.id, ...row });
    }
  } catch (e) {
    return toActionError(e);
  }
  revalidatePath("/viagens");
  redirect("/viagens");
}

export async function deleteTrip(formData: FormData) {
  const user = await requireUser();
  const id = z.string().uuid().parse(formData.get("id"));
  await db.delete(schema.trips).where(and(eq(schema.trips.id, id), eq(schema.trips.userId, user.id)));
  revalidatePath("/viagens");
  redirect("/viagens");
}
