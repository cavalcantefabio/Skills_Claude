import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { recordTransaction, transferPoints } from "@/server/services/ledger";
import { DomainError } from "@/server/services/errors";
import { launchPayload, quotePayload, transferPayload, tripPayload } from "./tools";

/**
 * Executa (ou recusa) uma proposta do agente. Só roda por ação explícita da pessoa.
 * O payload é revalidado e passa pelas mesmas regras de negócio dos formulários.
 */
export async function decideAction(userId: string, actionId: string, decision: "confirmar" | "recusar") {
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(schema.agentActions)
      .where(and(eq(schema.agentActions.id, actionId), eq(schema.agentActions.userId, userId)))
      .for("update");
    if (!a) throw new DomainError("Proposta não encontrada.");
    if (a.status !== "pendente") throw new DomainError("Esta proposta já foi decidida.");

    const finish = (status: "confirmada" | "recusada" | "falhou", resultMessage: string) =>
      tx
        .update(schema.agentActions)
        .set({ status, resultMessage, decidedAt: new Date() })
        .where(eq(schema.agentActions.id, a.id))
        .returning();

    if (decision === "recusar") return (await finish("recusada", "Recusada pela pessoa."))[0];

    try {
      if (a.kind === "lancamento") {
        const p = launchPayload.parse(a.payload);
        await recordTransaction(tx, { userId, ...p });
      } else if (a.kind === "transferencia") {
        const p = transferPayload.parse(a.payload);
        await transferPoints(
          {
            userId,
            fromAccountId: p.fromAccountId,
            toAccountId: p.toAccountId,
            points: p.points,
            ratio: p.ratio,
            bonusPct: p.bonusPct,
            occurredOn: p.occurredOn,
            expiresAt: p.expiresAt,
            description: `Paridade ${p.ratioLabel} com bônus de ${p.bonusPct}% (proposta do agente)`,
          },
          tx,
        );
      } else if (a.kind === "viagem") {
        const p = tripPayload.parse(a.payload);
        await tx.insert(schema.trips).values({
          userId,
          ...p,
          flexibleDates: p.flexDays > 0,
          budgetBrl: p.budgetBrl != null ? p.budgetBrl.toFixed(2) : null,
        });
      } else {
        const p = quotePayload.parse(a.payload);
        const [trip] = await tx
          .select({ id: schema.trips.id })
          .from(schema.trips)
          .where(and(eq(schema.trips.id, p.tripId), eq(schema.trips.userId, userId)));
        if (!trip) throw new DomainError("A viagem desta cotação não existe mais.");
        if (p.programId) {
          const [prog] = await tx
            .select({ id: schema.programs.id })
            .from(schema.programs)
            .where(and(eq(schema.programs.id, p.programId), or(isNull(schema.programs.ownerUserId), eq(schema.programs.ownerUserId, userId))));
          if (!prog) throw new DomainError("Programa da cotação não encontrado.");
        }
        await tx.insert(schema.tripQuotes).values({
          userId,
          tripId: p.tripId,
          kind: p.kind,
          certainty: p.certainty,
          programId: p.programId,
          label: p.label,
          milesPerPax: p.milesPerPax,
          taxesPerPaxBrl: p.taxesPerPaxBrl != null ? p.taxesPerPaxBrl.toFixed(2) : null,
          cashPerPaxBrl: p.cashPerPaxBrl != null ? p.cashPerPaxBrl.toFixed(2) : null,
          covers: p.covers,
          sourceUrl: p.sourceUrl,
          checkedOn: p.checkedOn,
          notes: "Registrada pelo agente com sua confirmação",
        });
      }
    } catch (e) {
      if (e instanceof DomainError) return (await finish("falhou", e.message))[0];
      throw e;
    }
    return (await finish("confirmada", { lancamento: "Movimentação registrada.", transferencia: "Transferência registrada.", viagem: "Viagem cadastrada.", cotacao: "Cotação registrada." }[a.kind]))[0];
  });
}
