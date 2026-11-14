"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/server/auth/session";
import { agentEnabled, getAnthropic } from "@/server/agent/client";
import { runRadar } from "@/server/radar/run";
import { env } from "@/server/env";
import { DomainError } from "@/server/services/errors";
import { formatUSD } from "@/lib/pricing";

export async function refreshRadar(): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  if (!agentEnabled()) return { ok: false, message: "O Radar usa a API do Claude, que não está configurada." };
  try {
    const r = await runRadar({ client: getAnthropic(), userId: user.id, dailyLimit: env.RADAR_DAILY_LIMIT });
    revalidatePath("/radar");
    revalidatePath("/alertas");
    return {
      ok: true,
      message: `${r.found} promoção(ões) vigente(s) encontrada(s). Custo estimado: ${formatUSD(r.costUsd)}.`,
    };
  } catch (e) {
    revalidatePath("/radar");
    if (e instanceof DomainError) return { ok: false, message: e.message };
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, message: "A chave da API do Claude é inválida." };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, message: "Limite de uso da API atingido. Tente mais tarde." };
    console.error("radar failed", e);
    return { ok: false, message: "Não foi possível atualizar o radar agora. Tente novamente." };
  }
}
