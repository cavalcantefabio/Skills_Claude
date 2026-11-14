import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { listAccounts, listLots } from "@/server/services/accounts";
import { listCards } from "@/server/services/cards";
import { listTransactions } from "@/server/services/transactions";
import { listTrips } from "@/server/services/trips";
import { listTripQuotes } from "@/server/services/trip-plan";
import { latestRadar } from "@/server/radar/run";
import { toCsv } from "@/lib/csv";
import { TX_LABEL } from "@/lib/labels";

/** Versão do formato do arquivo de exportação (para futuras importações). */
export const EXPORT_FORMAT_VERSION = 1;

const num = (v: string | null) => (v == null ? null : Number(v));

/**
 * Exportação completa dos dados da pessoa. Nunca inclui hash de senha, sessões,
 * tentativas de login ou chaves. O limite de crédito sai decifrado (é da própria pessoa).
 */
export async function buildExport(userId: string) {
  const [profileRow] = await db
    .select({ email: schema.users.email, createdAt: schema.users.createdAt, profile: schema.profiles })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .where(eq(schema.users.id, userId));

  const tripIds = (await db.select({ id: schema.trips.id }).from(schema.trips).where(eq(schema.trips.userId, userId))).map((t) => t.id);
  const [accounts, lots, transactions, cards, trips, customPrograms, simulations, conversations, radar, quotes] = await Promise.all([
    listAccounts(userId, profileRow?.profile.expiryAlertDays ?? 90),
    listLots(userId),
    listTransactions(userId, { limit: 100_000 }),
    listCards(userId),
    listTrips(userId),
    db.select().from(schema.programs).where(eq(schema.programs.ownerUserId, userId)),
    db.select().from(schema.simulations).where(eq(schema.simulations.userId, userId)).orderBy(asc(schema.simulations.createdAt)),
    db.select().from(schema.agentConversations).where(eq(schema.agentConversations.userId, userId)).orderBy(asc(schema.agentConversations.createdAt)),
    latestRadar(userId),
    listTripQuotes(userId, tripIds),
  ]);

  // Conversas do agente: só o texto visível (sem blocos internos de raciocínio ou ferramentas).
  const conversationExport = [];
  for (const c of conversations) {
    const msgs = await db
      .select({ role: schema.agentMessages.role, content: schema.agentMessages.content, createdAt: schema.agentMessages.createdAt })
      .from(schema.agentMessages)
      .where(and(eq(schema.agentMessages.conversationId, c.id)))
      .orderBy(asc(schema.agentMessages.seq));
    conversationExport.push({
      titulo: c.title,
      criada_em: c.createdAt.toISOString(),
      mensagens: msgs
        .filter((m) => m.role !== "system")
        .map((m) => ({
          autor: m.role === "user" ? "voce" : "agente",
          texto: (m.content as { type: string; text?: string }[])
            .filter((b) => b.type === "text" && b.text)
            .map((b) => b.text)
            .join("\n"),
          em: m.createdAt.toISOString(),
        }))
        .filter((m) => m.texto),
    });
  }

  return {
    formato: "milhas-inteligentes-ai",
    versao_formato: EXPORT_FORMAT_VERSION,
    exportado_em: new Date().toISOString(),
    perfil: {
      nome: profileRow?.profile.name,
      email: profileRow?.email,
      conta_criada_em: profileRow?.createdAt.toISOString(),
      cotacao_dolar_brl: num(profileRow?.profile.usdRateBrl ?? null),
      janela_alerta_dias: profileRow?.profile.expiryAlertDays,
    },
    programas_personalizados: customPrograms.map((p) => ({ slug: p.slug, nome: p.name, tipo: p.kind, unidade: p.unit })),
    programas: accounts.map((a) => ({
      programa: a.programName,
      slug: a.programSlug,
      unidade: a.unit,
      saldo_disponivel: a.balance,
      vencidos_nao_baixados: a.expiredNotWrittenOff,
      valor_milheiro_brl: a.milheiroValueBrl,
      clube: a.clubName,
      clube_mensalidade_brl: a.clubMonthlyCostBrl,
      clube_pontos_mensais: a.clubMonthlyPoints,
      observacoes: a.notes,
    })),
    saldos_por_validade: lots.map((l) => ({ programa: l.programName, unidade: l.unit, disponivel: l.remaining, creditado: l.original, validade: l.expiresAt })),
    movimentacoes: transactions.map((t) => ({
      data: t.occurredOn,
      programa: t.programName,
      tipo: t.type,
      pontos: t.points,
      unidade: t.unit,
      validade: t.expiresAt,
      cartao: t.cardName ? `${t.cardIssuer} ${t.cardName}` : null,
      custo_brl: t.costBrl,
      economia_brl: t.savingsBrl,
      descricao: t.description,
      transferencia: Boolean(t.transferGroupId),
    })),
    cartoes: cards.map((c) => ({
      banco: c.issuer,
      nome: c.name,
      bandeira: c.brand,
      anuidade_brl: c.annualFeeBrl,
      pontos_por_dolar: c.pointsPerUsd,
      pontos_por_real: c.pointsPerBrl,
      programa: c.programName,
      beneficios: c.benefits,
      limite_credito_brl: c.creditLimit,
      dia_vencimento_fatura: c.dueDay,
      observacoes: c.notes,
    })),
    viagens: trips.map(({ trip, programName }) => ({
      titulo: trip.title,
      origem: trip.origin,
      destino: trip.destination,
      ida: trip.departDate,
      volta: trip.returnDate,
      passageiros: trip.passengers,
      cabine: trip.cabin,
      situacao: trip.status,
      programa: programName,
      tipo: trip.tripType,
      flexibilidade_dias: trip.flexDays,
      orcamento_brl: num(trip.budgetBrl),
      alertar_dias_antes: trip.alertDaysBefore,
      observacoes: trip.notes,
      cotacoes: quotes
        .filter((q) => q.quote.tripId === trip.id)
        .map(({ quote: q, programName: p }) => ({
          tipo: q.kind,
          origem_do_valor: q.certainty,
          programa: p,
          site: q.label,
          milhas_por_passageiro: q.milesPerPax,
          taxas_por_passageiro_brl: num(q.taxesPerPaxBrl),
          preco_por_passageiro_brl: num(q.cashPerPaxBrl),
          cobre: q.covers,
          fonte: q.sourceUrl,
          consultado_em: q.checkedOn,
        })),
    })),
    simulacoes: simulations.map((s) => ({ calculadora: s.calculator, titulo: s.title, entradas: s.input, resultado: s.result, criada_em: s.createdAt.toISOString() })),
    conversas_agente: conversationExport,
    radar_ultima_pesquisa: radar
      ? {
          em: (radar.run.finishedAt ?? radar.run.startedAt).toISOString(),
          resumo: radar.run.summary,
          promocoes: radar.opportunities.map((o) => ({
            tipo: o.kind,
            titulo: o.title,
            origem: o.fromName,
            destino: o.toName,
            bonus_pct: num(o.bonusPct),
            desconto_pct: num(o.discountPct),
            fim: o.endsOn,
            fonte: o.sourceUrl,
          })),
        }
      : null,
  };
}

export async function transactionsCsv(userId: string) {
  const rows = await listTransactions(userId, { limit: 100_000 });
  return toCsv(rows, [
    { header: "Data", value: (t) => t.occurredOn },
    { header: "Programa", value: (t) => t.programName },
    { header: "Tipo", value: (t) => TX_LABEL[t.type] ?? t.type },
    { header: "Pontos", value: (t) => t.points },
    { header: "Unidade", value: (t) => t.unit },
    { header: "Validade", value: (t) => t.expiresAt },
    { header: "Cartão", value: (t) => (t.cardName ? `${t.cardIssuer} ${t.cardName}` : null) },
    { header: "Custo (R$)", value: (t) => t.costBrl },
    { header: "Economia (R$)", value: (t) => t.savingsBrl },
    { header: "Descrição", value: (t) => t.description },
  ]);
}

export async function lotsCsv(userId: string) {
  const rows = await listLots(userId);
  return toCsv(rows, [
    { header: "Programa", value: (l) => l.programName },
    { header: "Unidade", value: (l) => l.unit },
    { header: "Disponível", value: (l) => l.remaining },
    { header: "Creditado", value: (l) => l.original },
    { header: "Validade", value: (l) => l.expiresAt ?? "sem validade" },
  ]);
}
