import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let exp: typeof import("@/server/services/export");
let userId: string;
let otherId: string;

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  exp = await import("@/server/services/export");
  const ledger = await import("@/server/services/ledger");
  const { encrypt } = await import("@/server/crypto");

  const [u, o] = await db
    .insert(schema.users)
    .values([
      { email: "exporta@teste.dev", passwordHash: "$2b$12$segredo-que-nao-pode-sair" },
      { email: "alheio@teste.dev", passwordHash: "x" },
    ])
    .returning();
  userId = u.id;
  otherId = o.id;
  await db.insert(schema.profiles).values([
    { userId, name: "Pessoa Exporta" },
    { userId: otherId, name: "Alheio" },
  ]);
  const [smiles] = await db.select().from(schema.programs).where(eq(schema.programs.slug, "smiles"));
  for (const id of [userId, otherId]) {
    const [acc] = await db.insert(schema.loyaltyAccounts).values({ userId: id, programId: smiles.id }).returning();
    await db.transaction((tx) =>
      ledger.recordTransaction(tx, {
        userId: id,
        accountId: acc.id,
        type: "acumulo",
        points: id === userId ? 1234 : 9999,
        occurredOn: "2026-01-01",
        description: id === userId ? '=HYPERLINK("x"); "aspas"' : "segredo do outro",
      }),
    );
  }
  await db.insert(schema.cards).values({ userId, issuer: "Banco", name: "Black", brand: "visa", pointsPerUsd: "2", creditLimitEnc: encrypt("15000") });
  const [conv] = await db.insert(schema.agentConversations).values({ userId, title: "Pergunta" }).returning();
  await db.insert(schema.agentMessages).values([
    { conversationId: conv.id, seq: 1, role: "user", content: [{ type: "text", text: "Qual meu saldo?" }] },
    { conversationId: conv.id, seq: 2, role: "system", content: [{ type: "text", text: "contexto interno" }] },
    {
      conversationId: conv.id,
      seq: 3,
      role: "assistant",
      content: [
        { type: "thinking", thinking: "raciocínio interno", signature: "s" },
        { type: "text", text: "Você tem 1.234 milhas." },
      ],
    },
  ]);
});

describe("exportação de dados", () => {
  it("o backup completo traz só os dados da pessoa e nunca a senha", async () => {
    const data = await exp.buildExport(userId);
    const raw = JSON.stringify(data);
    expect(raw).not.toContain("segredo-que-nao-pode-sair");
    expect(raw).not.toContain("segredo do outro");
    expect(raw).not.toContain("9999");
    expect(data.perfil.email).toBe("exporta@teste.dev");
    expect(data.programas[0].saldo_disponivel).toBe(1234);
    expect(data.movimentacoes).toHaveLength(1);
    expect(data.cartoes[0].limite_credito_brl).toBe(15000);
  });

  it("das conversas com o agente sai só o texto visível", async () => {
    const data = await exp.buildExport(userId);
    const raw = JSON.stringify(data.conversas_agente);
    expect(data.conversas_agente[0].mensagens.map((m) => m.autor)).toEqual(["voce", "agente"]);
    expect(raw).toContain("Você tem 1.234 milhas.");
    expect(raw).not.toContain("raciocínio interno");
    expect(raw).not.toContain("contexto interno");
  });

  it("o CSV de movimentações é seguro para o Excel", async () => {
    const csv = await exp.transactionsCsv(userId);
    expect(csv.startsWith("﻿Data;Programa;Tipo;Pontos")).toBe(true);
    expect(csv).toContain("2026-01-01;Smiles;Acúmulo;1234;milhas");
    expect(csv).toContain(`"'=HYPERLINK(""x""); ""aspas"""`);
    expect(csv).not.toContain("segredo do outro");
  });
});
