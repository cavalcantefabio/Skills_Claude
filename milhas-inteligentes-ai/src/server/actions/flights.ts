"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { agentEnabled, getAnthropic } from "@/server/agent/client";
import { runFlightSearch } from "@/server/flights/run";
import { recordHits } from "@/server/services/flight-alerts";
import { env } from "@/server/env";
import { DomainError, toActionError, type ActionState } from "@/server/services/errors";
import { ALERT_CABINS, ALERT_PAY, DATE_MODES } from "@/lib/flight-alerts";
import { fieldErrors, optInt, optIsoDate, optMoney } from "@/lib/validation";
import { placeCodes } from "@/lib/airports";
import { formatUSD } from "@/lib/pricing";

const placeSchema = z.object({
  kind: z.enum(["regiao", "estado", "pais", "cidade", "aeroporto", "codigo"]),
  label: z.string().trim().min(1).max(100),
  codes: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1).max(80),
});
const placesField = (label: string) =>
  z.preprocess(
    (v) => {
      try {
        return typeof v === "string" && v ? JSON.parse(v) : [];
      } catch {
        return null;
      }
    },
    z.array(placeSchema, { error: `Seleção de ${label} inválida.` }).max(20, "Escolha até 20 lugares."),
  );

const alertSchema = z
  .object({
    origins: placesField("origem"),
    destinations: placesField("destino"),
    dateMode: z.enum(DATE_MODES),
    month: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{4}-\d{2}$/).optional()),
    dateFrom: optIsoDate("a data inicial"),
    dateTo: optIsoDate("a data final"),
    cabin: z.enum(ALERT_CABINS),
    pay: z.enum(ALERT_PAY),
    maxMiles: optInt("o limite de milhas", { min: 1000, max: 2_000_000 }),
    maxCashBrl: optMoney("o limite em reais", { min: 1, max: 1_000_000 }),
  })
  .superRefine((v, ctx) => {
    if (!v.origins.length && !v.destinations.length) {
      ctx.addIssue({ code: "custom", path: ["origins"], message: "Escolha a origem, o destino ou os dois." });
    }
    if (v.dateMode === "mes" && !v.month) ctx.addIssue({ code: "custom", path: ["dateMode"], message: "Escolha o mês." });
    if (v.dateMode === "datas") {
      if (!v.dateFrom || !v.dateTo) ctx.addIssue({ code: "custom", path: ["dateFrom"], message: "Informe as duas datas." });
      else if (v.dateFrom > v.dateTo) ctx.addIssue({ code: "custom", path: ["dateTo"], message: "A data final deve ser depois da inicial." });
    }
  });

export async function saveRouteAlert(alertId: string | null, _: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = alertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Revise os campos destacados.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const row = {
    originPlaces: v.origins,
    destinationPlaces: v.destinations,
    originCodes: placeCodes(v.origins),
    destinationCodes: placeCodes(v.destinations),
    dateMode: v.dateMode,
    month: v.dateMode === "mes" ? v.month! : null,
    dateFrom: v.dateMode === "datas" ? v.dateFrom! : null,
    dateTo: v.dateMode === "datas" ? v.dateTo! : null,
    cabin: v.cabin,
    pay: v.pay,
    maxMiles: v.pay === "dinheiro" ? null : (v.maxMiles ?? null),
    maxCashBrl: v.pay === "milhas" || v.maxCashBrl == null ? null : v.maxCashBrl.toFixed(2),
  };
  try {
    let id = alertId;
    if (alertId) {
      if (!z.string().uuid().safeParse(alertId).success) throw new DomainError("Aviso não encontrado.");
      const res = await db
        .update(schema.routeAlerts)
        .set({ ...row, updatedAt: new Date() })
        .where(and(eq(schema.routeAlerts.id, alertId), eq(schema.routeAlerts.userId, user.id)))
        .returning({ id: schema.routeAlerts.id });
      if (!res.length) throw new DomainError("Aviso não encontrado.");
      // Critérios mudaram: refaz os disparos deste aviso.
      await db.delete(schema.routeAlertHits).where(eq(schema.routeAlertHits.alertId, alertId));
    } else {
      const [a] = await db.insert(schema.routeAlerts).values({ userId: user.id, ...row }).returning({ id: schema.routeAlerts.id });
      id = a.id;
    }
    const hits = await recordHits(user.id, { alertIds: [id!] });
    revalidatePath("/voos");
    revalidatePath("/alertas");
    return {
      ok: true,
      message: hits
        ? `Aviso salvo. ${hits} voo(s) já encontrado(s) combinam com ele.`
        : "Aviso salvo. Você será avisado quando uma busca encontrar um voo compatível.",
    };
  } catch (e) {
    return toActionError(e);
  }
}

const idSchema = z.string().uuid();

export async function setRouteAlertActive(alertId: string, active: boolean) {
  const user = await requireUser();
  if (!idSchema.safeParse(alertId).success) return;
  await db
    .update(schema.routeAlerts)
    .set({ active, updatedAt: new Date() })
    .where(and(eq(schema.routeAlerts.id, alertId), eq(schema.routeAlerts.userId, user.id)));
  if (active) await recordHits(user.id, { alertIds: [alertId] });
  revalidatePath("/voos");
  revalidatePath("/alertas");
}

export async function deleteRouteAlert(alertId: string) {
  const user = await requireUser();
  if (!idSchema.safeParse(alertId).success) return;
  await db.delete(schema.routeAlerts).where(and(eq(schema.routeAlerts.id, alertId), eq(schema.routeAlerts.userId, user.id)));
  revalidatePath("/voos");
  revalidatePath("/alertas");
}

export async function searchFlights(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!agentEnabled()) return { ok: false, message: "A busca de voos usa a API do Claude, que não está configurada." };
  try {
    const r = await runFlightSearch({ client: getAnthropic(), userId: user.id, dailyLimit: env.FLIGHT_SEARCH_DAILY_LIMIT });
    revalidatePath("/voos");
    revalidatePath("/alertas");
    return {
      ok: true,
      message: `${r.found} voo(s) novo(s) encontrado(s)${r.hits ? `, ${r.hits} disparo(s) dos seus avisos` : ""}. Custo estimado: ${formatUSD(r.costUsd)}.`,
    };
  } catch (e) {
    revalidatePath("/voos");
    if (e instanceof DomainError) return { ok: false, message: e.message };
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, message: "A chave da API do Claude é inválida." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, message: "Limite de uso da API atingido. Tente mais tarde." };
    console.error("flight search failed", e);
    return { ok: false, message: "Não foi possível buscar voos agora. Tente novamente." };
  }
}
