"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { decideAction } from "@/server/agent/decide";
import { toActionError } from "@/server/services/errors";

export type DecideResult = { ok: boolean; message?: string; status?: string };

export async function decideAgentAction(actionId: string, decision: "confirmar" | "recusar"): Promise<DecideResult> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(actionId);
  const d = z.enum(["confirmar", "recusar"]).safeParse(decision);
  if (!id.success || !d.success) return { ok: false, message: "Pedido inválido." };
  try {
    const a = await decideAction(user.id, id.data, d.data);
    revalidatePath("/", "layout");
    return { ok: a.status !== "falhou", status: a.status, message: a.resultMessage ?? undefined };
  } catch (e) {
    return toActionError(e);
  }
}

export async function deleteConversation(formData: FormData) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { ok: false, message: "Conversa inválida." };
  await db
    .delete(schema.agentConversations)
    .where(and(eq(schema.agentConversations.id, id.data), eq(schema.agentConversations.userId, user.id)));
  revalidatePath("/agente");
  redirect("/agente");
}
