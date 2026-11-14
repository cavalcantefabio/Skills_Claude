import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

// Importados dinamicamente depois do reset, para o pool apontar para o banco de teste.
let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let ledger: typeof import("@/server/services/ledger");

let userId: string;
let otherUserId: string;
let livelo: string;
let smiles: string;

async function balanceOf(accountId: string) {
  const [r] = await db
    .select({ lots: sql<number>`coalesce(sum(${schema.balances.remaining}),0)::int` })
    .from(schema.balances)
    .where(eq(schema.balances.accountId, accountId));
  const [t] = await db
    .select({ txs: sql<number>`coalesce(sum(${schema.transactions.points}),0)::int` })
    .from(schema.transactions)
    .where(eq(schema.transactions.accountId, accountId));
  // Invariante: lotes == histórico.
  expect(r.lots).toBe(t.txs);
  return r.lots;
}

const rec = (input: Omit<Parameters<typeof ledger.recordTransaction>[1], "userId"> & { userId?: string }) =>
  db.transaction((tx) => ledger.recordTransaction(tx, { userId, ...input }));

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  ledger = await import("@/server/services/ledger");

  const [u, o] = await db
    .insert(schema.users)
    .values([
      { email: "a@teste.dev", passwordHash: "x" },
      { email: "b@teste.dev", passwordHash: "x" },
    ])
    .returning();
  userId = u.id;
  otherUserId = o.id;
  const progs = await db.select().from(schema.programs);
  const id = (slug: string) => progs.find((p) => p.slug === slug)!.id;
  const [a, b] = await db
    .insert(schema.loyaltyAccounts)
    .values([
      { userId, programId: id("livelo") },
      { userId, programId: id("smiles") },
    ])
    .returning();
  livelo = a.id;
  smiles = b.id;
});

describe("ledger", () => {
  it("credita criando lotes com validade", async () => {
    await rec({ accountId: livelo, type: "saldo_inicial", points: 10_000, occurredOn: "2026-01-01", expiresAt: "2026-12-31" });
    await rec({ accountId: livelo, type: "acumulo", points: 5_000, occurredOn: "2026-02-01", expiresAt: "2026-06-30" });
    await rec({ accountId: livelo, type: "bonus", points: 1_000, occurredOn: "2026-02-01" });
    expect(await balanceOf(livelo)).toBe(16_000);
  });

  it("debita consumindo primeiro o lote que vence antes (FIFO por validade)", async () => {
    await rec({ accountId: livelo, type: "resgate", points: -6_000, occurredOn: "2026-03-01", savingsBrl: 300 });
    const lots = await db
      .select()
      .from(schema.balances)
      .where(eq(schema.balances.accountId, livelo))
      .orderBy(schema.balances.expiresAt);
    const byExpiry = Object.fromEntries(lots.map((l) => [l.expiresAt ?? "sem", l.remaining]));
    expect(byExpiry["2026-06-30"]).toBe(0); // consumido por inteiro
    expect(byExpiry["2026-12-31"]).toBe(9_000); // consumido 1.000
    expect(byExpiry["sem"]).toBe(1_000); // sem validade fica por último
    expect(await balanceOf(livelo)).toBe(10_000);
  });

  it("recusa débito maior que o saldo, sem alterar nada", async () => {
    await expect(rec({ accountId: livelo, type: "resgate", points: -999_999, occurredOn: "2026-03-02" })).rejects.toThrow(
      /Saldo insuficiente/,
    );
    expect(await balanceOf(livelo)).toBe(10_000);
  });

  it("valida o sinal por tipo e a economia só em resgates", async () => {
    await expect(rec({ accountId: livelo, type: "acumulo", points: -10, occurredOn: "2026-03-02" })).rejects.toThrow();
    await expect(rec({ accountId: livelo, type: "resgate", points: 10, occurredOn: "2026-03-02" })).rejects.toThrow();
    await expect(
      rec({ accountId: livelo, type: "acumulo", points: 10, occurredOn: "2026-03-02", savingsBrl: 5 }),
    ).rejects.toThrow(/Economia/);
  });

  it("impede acesso à conta de outro usuário", async () => {
    await expect(
      rec({ userId: otherUserId, accountId: livelo, type: "acumulo", points: 10, occurredOn: "2026-03-02" }),
    ).rejects.toThrow(/não encontrado/);
  });

  it("transfere com paridade e bônus, ligando as duas pernas", async () => {
    expect(ledger.transferReceived(10_000, 1, 100)).toBe(20_000);
    expect(ledger.transferReceived(3_333, 0.5, 30)).toBe(2_166);
    const { received } = await ledger.transferPoints({
      userId,
      fromAccountId: livelo,
      toAccountId: smiles,
      points: 4_000,
      ratio: 1,
      bonusPct: 80,
      occurredOn: "2026-04-01",
    });
    expect(received).toBe(7_200);
    expect(await balanceOf(livelo)).toBe(6_000);
    expect(await balanceOf(smiles)).toBe(7_200);
    const legs = await db.select().from(schema.transactions).where(sql`${schema.transactions.transferGroupId} is not null`);
    expect(legs).toHaveLength(2);
    expect(new Set(legs.map((l) => l.transferGroupId)).size).toBe(1);
  });

  it("transferência sem saldo não grava nenhuma perna (atômica)", async () => {
    await expect(
      ledger.transferPoints({ userId, fromAccountId: livelo, toAccountId: smiles, points: 1_000_000, ratio: 1, bonusPct: 0, occurredOn: "2026-04-02" }),
    ).rejects.toThrow(/Saldo insuficiente/);
    expect(await balanceOf(smiles)).toBe(7_200);
  });

  it("só exclui créditos intactos; débitos e créditos consumidos exigem ajuste", async () => {
    const fresh = await rec({ accountId: smiles, type: "acumulo", points: 100, occurredOn: "2026-05-01" });
    await ledger.deleteTransaction(userId, fresh.id);
    expect(await balanceOf(smiles)).toBe(7_200);

    const [consumed] = await db
      .select()
      .from(schema.transactions)
      .where(sql`${schema.transactions.accountId} = ${livelo} and ${schema.transactions.expiresAt} = '2026-06-30'`);
    await expect(ledger.deleteTransaction(userId, consumed.id)).rejects.toThrow(/ajuste/);

    const [debit] = await db.select().from(schema.transactions).where(eq(schema.transactions.type, "resgate"));
    await expect(ledger.deleteTransaction(userId, debit.id)).rejects.toThrow(/ajuste/);
    await expect(ledger.deleteTransaction(otherUserId, fresh.id)).rejects.toThrow(/não encontrada/);
  });

  it("constraints do banco barram dados inconsistentes mesmo fora do serviço", async () => {
    await expect(
      db.insert(schema.transactions).values({ userId, accountId: livelo, type: "acumulo", points: -5, occurredOn: "2026-01-01" }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.balances).values({ accountId: livelo, original: 10, remaining: 20 }),
    ).rejects.toThrow();
  });
});
