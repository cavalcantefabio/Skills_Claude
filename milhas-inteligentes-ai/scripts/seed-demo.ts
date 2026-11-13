/**
 * Cria (ou recria) um usuário de demonstração com dados fictícios.
 * Uso: pnpm db:seed           → demo@milhas.local / senha: Demo12345678
 * Recusa rodar com NODE_ENV=production.
 *
 * Usa o mesmo serviço de lançamentos do app (recordTransaction/transferPoints),
 * então os dados respeitam as mesmas regras de integridade.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { recordTransaction, transferPoints } from "@/server/services/ledger";
import { hashPassword } from "@/server/auth/password";
import { encrypt } from "@/server/crypto";
import { addDaysISO, monthRange, todayISO } from "@/lib/dates";

const EMAIL = "demo@milhas.local";
const PASSWORD = "Demo12345678";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Seed de demonstração não roda em produção.");

  await db.delete(schema.users).where(sql`lower(${schema.users.email}) = ${EMAIL}`);
  const [user] = await db
    .insert(schema.users)
    .values({ email: EMAIL, passwordHash: await hashPassword(PASSWORD) })
    .returning();
  await db.insert(schema.profiles).values({ userId: user.id, name: "Conta Demonstração", usdRateBrl: "5.4000" });

  const program = async (slug: string) => {
    const [p] = await db
      .select()
      .from(schema.programs)
      .where(and(eq(schema.programs.slug, slug), isNull(schema.programs.ownerUserId)));
    return p;
  };

  const account = async (slug: string, extra: Partial<typeof schema.loyaltyAccounts.$inferInsert> = {}) => {
    const p = await program(slug);
    const [a] = await db
      .insert(schema.loyaltyAccounts)
      .values({ userId: user.id, programId: p.id, ...extra })
      .returning();
    return a;
  };

  const livelo = await account("livelo", { milheiroValueBrl: "35.00" });
  const esfera = await account("esfera", { milheiroValueBrl: "30.00" });
  const smiles = await account("smiles", {
    milheiroValueBrl: "16.00",
    clubName: "Clube Smiles 2.000",
    clubMonthlyCostBrl: "84.00",
    clubMonthlyPoints: 2000,
  });
  const latam = await account("latam-pass", { milheiroValueBrl: "25.00" });
  const azul = await account("azul-fidelidade", { milheiroValueBrl: "14.00" });

  const [cardA, cardB, cardC] = await db
    .insert(schema.cards)
    .values([
      {
        userId: user.id,
        issuer: "Banco Exemplo",
        name: "Black Exemplo",
        brand: "mastercard",
        annualFeeBrl: "1200.00",
        pointsPerUsd: "2.20",
        programId: livelo.programId,
        benefits: "Salas VIP ilimitadas, seguro viagem",
        creditLimitEnc: encrypt("30000"),
        dueDay: 10,
      },
      {
        userId: user.id,
        issuer: "Banco Modelo",
        name: "Infinite Modelo",
        brand: "visa",
        annualFeeBrl: "900.00",
        pointsPerUsd: "2.00",
        programId: esfera.programId,
        benefits: "4 acessos/ano a salas VIP",
        dueDay: 5,
      },
      {
        userId: user.id,
        issuer: "Banco Digital",
        name: "Gold Digital",
        brand: "elo",
        annualFeeBrl: "0",
        pointsPerBrl: "1.00",
        programId: smiles.programId,
        dueDay: 20,
      },
    ])
    .returning();

  const today = todayISO();
  const months = monthRange(today, 14);
  const rec = (input: Omit<Parameters<typeof recordTransaction>[1], "userId">) =>
    db.transaction((tx) => recordTransaction(tx, { userId: user.id, ...input }));

  // Saldos iniciais (antes da janela), alguns com validade próxima.
  const start = `${months[0]}-01`;
  await rec({ accountId: livelo.id, type: "saldo_inicial", points: 42_000, occurredOn: start, expiresAt: addDaysISO(today, 400) });
  await rec({ accountId: esfera.id, type: "saldo_inicial", points: 18_000, occurredOn: start, expiresAt: addDaysISO(today, 25) });
  await rec({ accountId: smiles.id, type: "saldo_inicial", points: 35_000, occurredOn: start, expiresAt: addDaysISO(today, 70) });
  await rec({ accountId: latam.id, type: "saldo_inicial", points: 22_000, occurredOn: start, expiresAt: addDaysISO(today, 300) });
  await rec({ accountId: azul.id, type: "saldo_inicial", points: 9_500, occurredOn: start, expiresAt: null });

  // Acúmulos mensais com cartão + clube Smiles.
  for (const [i, m] of months.entries()) {
    const day = `${m}-12`;
    if (day > today) continue;
    const wobble = 1 + ((i * 37) % 11) / 20;
    await rec({ accountId: livelo.id, type: "acumulo", points: Math.round(4_800 * wobble), occurredOn: day, cardId: cardA.id, expiresAt: addDaysISO(day, 730) });
    await rec({ accountId: esfera.id, type: "acumulo", points: Math.round(2_600 * wobble), occurredOn: day, cardId: cardB.id, expiresAt: addDaysISO(day, 730) });
    await rec({ accountId: smiles.id, type: "acumulo", points: Math.round(1_400 * wobble), occurredOn: day, cardId: cardC.id, expiresAt: addDaysISO(day, 1095) });
    await rec({ accountId: smiles.id, type: "bonus", points: 2_000, occurredOn: `${m}-05` > today ? today : `${m}-05`, description: "Clube Smiles", expiresAt: addDaysISO(day, 1095), costBrl: 84 });
  }

  // Transferências bonificadas.
  const t1 = `${months[3]}-15`;
  await transferPoints({ userId: user.id, fromAccountId: livelo.id, toAccountId: smiles.id, points: 30_000, ratio: 1, bonusPct: 100, occurredOn: t1, expiresAt: addDaysISO(t1, 1095), description: "Transferência Livelo → Smiles (100% de bônus)" });
  const t2 = `${months[8]}-20`;
  await transferPoints({ userId: user.id, fromAccountId: esfera.id, toAccountId: latam.id, points: 20_000, ratio: 1, bonusPct: 30, occurredOn: t2, expiresAt: addDaysISO(t2, 730), description: "Transferência Esfera → LATAM Pass (30% de bônus)" });

  // Compra de pontos.
  await rec({ accountId: livelo.id, type: "compra", points: 10_000, occurredOn: `${months[6]}-08`, costBrl: 350, description: "Compra com 50% de desconto", expiresAt: addDaysISO(`${months[6]}-08`, 730) });

  // Resgates com economia registrada.
  await rec({ accountId: smiles.id, type: "resgate", points: -48_000, occurredOn: `${months[5]}-03`, costBrl: 92.4, savingsBrl: 1_340, description: "GRU–LIS ida, econômica" });
  await rec({ accountId: latam.id, type: "resgate", points: -26_000, occurredOn: `${months[10]}-11`, costBrl: 56.1, savingsBrl: 690, description: "CGH–SDU ida e volta" });
  await rec({ accountId: azul.id, type: "resgate", points: -6_000, occurredOn: `${months[12]}-02`, costBrl: 38.9, savingsBrl: 210, description: "VCP–CNF ida" });

  // Expiração registrada.
  await rec({ accountId: esfera.id, type: "expiracao", points: -1_200, occurredOn: `${months[9]}-28`, description: "Pontos vencidos" });

  // Créditos recentes com validade curta, para demonstrar os alertas de vencimento.
  await rec({ accountId: esfera.id, type: "bonus", points: 3_500, occurredOn: addDaysISO(today, -300), expiresAt: addDaysISO(today, 21), description: "Bônus de campanha" });
  await rec({ accountId: smiles.id, type: "bonus", points: 5_000, occurredOn: addDaysISO(today, -330), expiresAt: addDaysISO(today, 64), description: "Bônus promocional" });

  await db.insert(schema.trips).values({
    userId: user.id,
    title: "Férias em Lisboa",
    origin: "GRU",
    destination: "LIS",
    departDate: addDaysISO(today, 120),
    returnDate: addDaysISO(today, 134),
    passengers: 2,
    cabin: "economica",
    programId: smiles.programId,
    milesNeeded: 120_000,
    cashPriceBrl: "7800.00",
    notes: "Datas flexíveis em ±3 dias.",
    flexibleDates: true,
  });

  console.log(`Usuário de demonstração criado: ${EMAIL} / ${PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
