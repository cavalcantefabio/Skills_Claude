import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { db, schema, type Tx } from "@/server/db";
import { DomainError } from "@/server/services/errors";

export type TransactionType = (typeof schema.transactionType.enumValues)[number];

export const CREDIT_TYPES: TransactionType[] = [
  "saldo_inicial",
  "acumulo",
  "bonus",
  "compra",
  "transferencia_entrada",
];
export const DEBIT_TYPES: TransactionType[] = ["transferencia_saida", "resgate", "expiracao"];

export type RecordInput = {
  userId: string;
  accountId: string;
  type: TransactionType;
  /** Positivo para créditos, negativo para débitos. */
  points: number;
  occurredOn: string;
  expiresAt?: string | null;
  cardId?: string | null;
  costBrl?: number | null;
  savingsBrl?: number | null;
  description?: string | null;
  transferGroupId?: string | null;
};

/** Trava e devolve a conta, garantindo que pertence ao usuário. */
async function lockAccount(tx: Tx, userId: string, accountId: string) {
  const [account] = await tx
    .select({ id: schema.loyaltyAccounts.id })
    .from(schema.loyaltyAccounts)
    .where(and(eq(schema.loyaltyAccounts.id, accountId), eq(schema.loyaltyAccounts.userId, userId)))
    .for("update");
  if (!account) throw new DomainError("Programa não encontrado.");
  return account;
}

async function assertCardOwner(tx: Tx, userId: string, cardId: string) {
  const [card] = await tx
    .select({ id: schema.cards.id })
    .from(schema.cards)
    .where(and(eq(schema.cards.id, cardId), eq(schema.cards.userId, userId)));
  if (!card) throw new DomainError("Cartão não encontrado.");
}

/**
 * Registra uma movimentação mantendo o invariante:
 *   soma(balances.remaining) da conta == soma(transactions.points) da conta.
 * Créditos geram um lote; débitos consomem lotes em ordem de vencimento (FIFO).
 */
export async function recordTransaction(tx: Tx, input: RecordInput) {
  const { userId, accountId, type, points } = input;
  if (!Number.isInteger(points) || points === 0) throw new DomainError("Quantidade de pontos inválida.");
  if (CREDIT_TYPES.includes(type) && points < 0) throw new DomainError("Este tipo de movimentação deve ser positivo.");
  if (DEBIT_TYPES.includes(type) && points > 0) throw new DomainError("Este tipo de movimentação deve ser negativo.");
  if (points < 0 && input.expiresAt) throw new DomainError("Validade só se aplica a créditos.");
  if (input.savingsBrl != null && type !== "resgate") throw new DomainError("Economia só se aplica a resgates.");

  await lockAccount(tx, userId, accountId);
  if (input.cardId) await assertCardOwner(tx, userId, input.cardId);

  const [created] = await tx
    .insert(schema.transactions)
    .values({
      userId,
      accountId,
      type,
      points,
      occurredOn: input.occurredOn,
      expiresAt: points > 0 ? (input.expiresAt ?? null) : null,
      cardId: input.cardId ?? null,
      costBrl: input.costBrl != null ? input.costBrl.toFixed(2) : null,
      savingsBrl: input.savingsBrl != null ? input.savingsBrl.toFixed(2) : null,
      description: input.description ?? null,
      transferGroupId: input.transferGroupId ?? null,
    })
    .returning();

  if (points > 0) {
    await tx.insert(schema.balances).values({
      accountId,
      sourceTransactionId: created.id,
      original: points,
      remaining: points,
      expiresAt: input.expiresAt ?? null,
    });
    return created;
  }

  // Débito: consome lotes, primeiro os que vencem antes; lotes sem validade por último.
  let toConsume = -points;
  const lots = await tx
    .select()
    .from(schema.balances)
    .where(and(eq(schema.balances.accountId, accountId), gt(schema.balances.remaining, 0)))
    .orderBy(sql`${schema.balances.expiresAt} asc nulls last`, asc(schema.balances.createdAt))
    .for("update");

  const available = lots.reduce((s, l) => s + l.remaining, 0);
  if (available < toConsume) {
    throw new DomainError(
      `Saldo insuficiente: disponível ${available.toLocaleString("pt-BR")}, necessário ${toConsume.toLocaleString("pt-BR")}.`,
    );
  }
  for (const lot of lots) {
    if (toConsume === 0) break;
    const take = Math.min(lot.remaining, toConsume);
    await tx
      .update(schema.balances)
      .set({ remaining: lot.remaining - take })
      .where(eq(schema.balances.id, lot.id));
    toConsume -= take;
  }
  return created;
}

/**
 * Exclui uma movimentação. Para preservar o histórico dos lotes, só é possível
 * excluir créditos cujo lote ainda não foi consumido. Débitos devem ser
 * corrigidos com um lançamento de "ajuste".
 */
export async function deleteTransaction(userId: string, transactionId: string) {
  await db.transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(schema.transactions)
      .where(and(eq(schema.transactions.id, transactionId), eq(schema.transactions.userId, userId)));
    if (!t) throw new DomainError("Movimentação não encontrada.");
    if (t.transferGroupId) throw new DomainError("Transferências não podem ser excluídas; registre um ajuste.");
    await lockAccount(tx, userId, t.accountId);
    if (t.points < 0) throw new DomainError("Débitos não podem ser excluídos; registre um ajuste positivo.");
    const [lot] = await tx
      .select()
      .from(schema.balances)
      .where(eq(schema.balances.sourceTransactionId, t.id))
      .for("update");
    if (!lot || lot.remaining !== lot.original) {
      throw new DomainError("Os pontos deste crédito já foram usados; registre um ajuste negativo.");
    }
    await tx.delete(schema.balances).where(eq(schema.balances.id, lot.id));
    await tx.delete(schema.transactions).where(eq(schema.transactions.id, t.id));
  });
}

export type TransferInput = {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  points: number;
  /** Paridade: milhas recebidas por ponto enviado (1:1 = 1; 2:1 = 0,5). */
  ratio: number;
  bonusPct: number;
  occurredOn: string;
  expiresAt?: string | null;
  description?: string | null;
};

/** Calcula pontos recebidos em uma transferência (arredonda para baixo, como os programas). */
export function transferReceived(points: number, ratio: number, bonusPct: number) {
  return Math.floor(points * ratio * (1 + bonusPct / 100));
}

export async function transferPoints(input: TransferInput) {
  if (input.fromAccountId === input.toAccountId) throw new DomainError("Escolha programas diferentes.");
  const received = transferReceived(input.points, input.ratio, input.bonusPct);
  if (received <= 0) throw new DomainError("A transferência resultaria em zero pontos.");
  const group = randomUUID();
  return db.transaction(async (tx) => {
    // Trava as duas contas em ordem determinística para evitar deadlock.
    const [a, b] = [input.fromAccountId, input.toAccountId].sort();
    await lockAccount(tx, input.userId, a);
    await lockAccount(tx, input.userId, b);
    const desc = input.description ?? null;
    await recordTransaction(tx, {
      userId: input.userId,
      accountId: input.fromAccountId,
      type: "transferencia_saida",
      points: -input.points,
      occurredOn: input.occurredOn,
      description: desc,
      transferGroupId: group,
    });
    await recordTransaction(tx, {
      userId: input.userId,
      accountId: input.toAccountId,
      type: "transferencia_entrada",
      points: received,
      occurredOn: input.occurredOn,
      expiresAt: input.expiresAt ?? null,
      description: desc ?? `Paridade ${input.ratio} com bônus de ${input.bonusPct}%`,
      transferGroupId: group,
    });
    return { received };
  });
}
