"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { CALCULATORS, runCalculator, type CalculatorKey } from "@/lib/calculators";
import type { ActionState } from "@/server/services/errors";

const keys = Object.keys(CALCULATORS) as [CalculatorKey, ...CalculatorKey[]];

/** Salva uma simulação. O resultado é recalculado no servidor: nunca confiamos no cliente. */
export async function saveSimulation(calculator: CalculatorKey, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const key = z.enum(keys).parse(calculator);
  const raw = Object.fromEntries(formData);
  const title = z.string().trim().max(80).optional().parse(raw.title) || "Simulação";
  delete raw.title;
  const run = runCalculator(key, raw);
  if (!run.ok) return { ok: false, fieldErrors: run.fieldErrors, message: "Corrija os campos antes de salvar." };
  await db.insert(schema.simulations).values({
    userId: user.id,
    calculator: key,
    title,
    input: run.input,
    result: { metrics: run.result.metrics, verdict: run.result.verdict ?? null, raw: run.result.raw },
  });
  revalidatePath("/calculadoras");
  return { ok: true, message: "Simulação salva." };
}

export async function deleteSimulation(formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Simulação inválida." };
  await db.delete(schema.simulations).where(and(eq(schema.simulations.id, id.data), eq(schema.simulations.userId, user.id)));
  revalidatePath("/calculadoras");
  return { ok: true };
}
