import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { decrypt } from "@/server/crypto";

export type CardView = Awaited<ReturnType<typeof listCards>>[number];

const n = (v: string | null) => (v == null ? null : Number(v));

function safeDecrypt(v: string | null) {
  if (!v) return null;
  try {
    return Number(decrypt(v));
  } catch {
    return null; // chave trocada ou dado corrompido: não quebra a página
  }
}

export async function listCards(userId: string, cardId?: string) {
  const rows = await db
    .select({ card: schema.cards, programName: schema.programs.name, unit: schema.programs.unit })
    .from(schema.cards)
    .leftJoin(schema.programs, eq(schema.programs.id, schema.cards.programId))
    .where(cardId ? and(eq(schema.cards.userId, userId), eq(schema.cards.id, cardId)) : eq(schema.cards.userId, userId))
    .orderBy(asc(schema.cards.issuer), asc(schema.cards.name));
  return rows.map(({ card, programName, unit }) => ({
    id: card.id,
    issuer: card.issuer,
    name: card.name,
    brand: card.brand,
    annualFeeBrl: Number(card.annualFeeBrl),
    pointsPerUsd: n(card.pointsPerUsd),
    pointsPerBrl: n(card.pointsPerBrl),
    programId: card.programId,
    programName,
    unit,
    benefits: card.benefits,
    creditLimit: safeDecrypt(card.creditLimitEnc),
    dueDay: card.dueDay,
    notes: card.notes,
  }));
}
