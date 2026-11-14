import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let ledger: typeof import("@/server/services/ledger");
let accounts: typeof import("@/server/services/accounts");
let userId: string;
let acc: string;

const rec = (input: Omit<Parameters<typeof ledger.recordTransaction>[1], "userId">) =>
  db.transaction((tx) => ledger.recordTransaction(tx, { userId, ...input }));

async function invariant() {
  const [l] = await db.select({ n: sql<number>`coalesce(sum(remaining),0)::int` }).from(schema.balances).where(eq(schema.balances.accountId, acc));
  const [t] = await db.select({ n: sql<number>`coalesce(sum(points),0)::int` }).from(schema.transactions).where(eq(schema.transactions.accountId, acc));
  expect(l.n).toBe(t.n);
}

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  ledger = await import("@/server/services/ledger");
  accounts = await import("@/server/services/accounts");
  const [u] = await db.insert(schema.users).values({ email: "venc@teste.dev", passwordHash: "x" }).returning();
  userId = u.id;
  const [p] = await db.select().from(schema.programs).where(eq(schema.programs.slug, "smiles"));
  const [a] = await db.insert(schema.loyaltyAccounts).values({ userId, programId: p.id, milheiroValueBrl: "20.00" }).returning();
  acc = a.id;
  // 5.000 vencidos em 2020, 3.000 válidos até 2099 e 1.000 sem validade.
  await rec({ accountId: acc, type: "saldo_inicial", points: 5000, occurredOn: "2019-01-01", expiresAt: "2020-01-01" });
  await rec({ accountId: acc, type: "acumulo", points: 3000, occurredOn: "2021-01-01", expiresAt: "2099-01-01" });
  await rec({ accountId: acc, type: "bonus", points: 1000, occurredOn: "2021-01-01" });
});

describe("pontos vencidos", () => {
  it("o saldo mostrado é o disponível: lotes vencidos ficam à parte", async () => {
    const [a] = await accounts.listAccounts(userId);
    expect(a.balance).toBe(4000);
    expect(a.expiredNotWrittenOff).toBe(5000);
    expect(a.estimatedValueBrl).toBe(80); // 4 milheiros × R$ 20
  });

  it("um débito não consome pontos que já estavam vencidos na data dele", async () => {
    await expect(rec({ accountId: acc, type: "resgate", points: -4500, occurredOn: "2026-11-01" })).rejects.toThrow(/Saldo insuficiente/);
    await rec({ accountId: acc, type: "resgate", points: -3500, occurredOn: "2026-11-01" });
    const lots = await db.select().from(schema.balances).where(eq(schema.balances.accountId, acc));
    expect(lots.find((l) => l.expiresAt === "2020-01-01")!.remaining).toBe(5000); // vencido intacto
    expect(lots.find((l) => l.expiresAt === "2099-01-01")!.remaining).toBe(0);
    expect(lots.find((l) => l.expiresAt === null)!.remaining).toBe(500);
    await invariant();
  });

  it("um débito com data anterior ao vencimento ainda pode usar o lote", async () => {
    await rec({ accountId: acc, type: "resgate", points: -1000, occurredOn: "2019-06-01" });
    const lots = await db.select().from(schema.balances).where(and(eq(schema.balances.accountId, acc), eq(schema.balances.expiresAt, "2020-01-01")));
    expect(lots[0].remaining).toBe(4000);
    await invariant();
  });

  it("registrar a expiração baixa exatamente os lotes vencidos, com a data do vencimento", async () => {
    const r = await ledger.writeOffExpired(userId, acc);
    expect(r.points).toBe(4000);
    const [a] = await accounts.listAccounts(userId);
    expect(a.expiredNotWrittenOff).toBe(0);
    expect(a.balance).toBe(500);
    const [tx] = await db
      .select()
      .from(schema.transactions)
      .where(and(eq(schema.transactions.accountId, acc), eq(schema.transactions.type, "expiracao")));
    expect(tx.points).toBe(-4000);
    expect(tx.occurredOn).toBe("2020-01-02");
    await invariant();
    // Sem vencidos, não faz nada.
    expect((await ledger.writeOffExpired(userId, acc)).points).toBe(0);
  });

  it("não baixa pontos de outra pessoa", async () => {
    const [o] = await db.insert(schema.users).values({ email: "outro2@teste.dev", passwordHash: "x" }).returning();
    await expect(ledger.writeOffExpired(o.id, acc)).rejects.toThrow(/não encontrado/);
  });
});
