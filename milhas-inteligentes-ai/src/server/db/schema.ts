import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const programKind = pgEnum("program_kind", ["banco", "aerea", "hotel", "varejo", "outro"]);

export const cardBrand = pgEnum("card_brand", [
  "visa",
  "mastercard",
  "elo",
  "amex",
  "hipercard",
  "diners",
  "outra",
]);

/**
 * Tipos de movimentação. O sinal dos pontos é validado por constraint:
 * créditos > 0, débitos < 0, ajuste pode ser qualquer sinal (≠ 0).
 */
export const transactionType = pgEnum("transaction_type", [
  "saldo_inicial",
  "acumulo",
  "bonus",
  "compra",
  "transferencia_entrada",
  "transferencia_saida",
  "resgate",
  "expiracao",
  "ajuste",
]);

export const calculatorKind = pgEnum("calculator_kind", [
  "custo_milheiro",
  "transferencia_bonificada",
  "compra_pontos",
  "dinheiro_vs_milhas",
  "retorno_cartao",
  "clube_pontos",
]);

export const tripStatus = pgEnum("trip_status", ["planejada", "emitida", "concluida", "cancelada"]);
export const cabinClass = pgEnum("cabin_class", ["economica", "premium", "executiva", "primeira"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ------------------------------------------------------------------ */
/* Usuários, perfis e sessões                                          */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Cotação de referência do dólar usada nas calculadoras (R$). */
    usdRateBrl: numeric("usd_rate_brl", { precision: 10, scale: 4 }).notNull().default("5.5000"),
    /** Janela, em dias, para considerar pontos "próximos do vencimento". */
    expiryAlertDays: smallint("expiry_alert_days").notNull().default(90),
    ...timestamps,
  },
  (t) => [check("profiles_expiry_days_chk", sql`${t.expiryAlertDays} between 1 and 365`)],
);

/** Sessões: guardamos apenas o hash SHA-256 do token; o token bruto fica só no cookie httpOnly. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ------------------------------------------------------------------ */
/* Programas de fidelidade (catálogo)                                  */
/* ------------------------------------------------------------------ */

/**
 * Catálogo. Programas do sistema têm owner_user_id nulo; o usuário pode
 * criar programas próprios ("Outros programas"), visíveis só para ele.
 */
export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: programKind("kind").notNull(),
    /** Nome da unidade exibida: "pontos", "milhas", "Avios"... */
    unit: text("unit").notNull().default("pontos"),
    website: text("website"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("programs_system_slug_idx").on(t.slug).where(sql`${t.ownerUserId} is null`),
    uniqueIndex("programs_owner_slug_idx").on(t.ownerUserId, t.slug).where(sql`${t.ownerUserId} is not null`),
  ],
);

/* ------------------------------------------------------------------ */
/* Conta do usuário em um programa + saldos por validade               */
/* ------------------------------------------------------------------ */

export const loyaltyAccounts = pgTable(
  "loyalty_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    clubName: text("club_name"),
    clubMonthlyCostBrl: numeric("club_monthly_cost_brl", { precision: 10, scale: 2 }),
    clubMonthlyPoints: integer("club_monthly_points"),
    /** Valor que o usuário atribui a 1.000 pontos (R$). Base do "valor econômico estimado". */
    milheiroValueBrl: numeric("milheiro_value_brl", { precision: 10, scale: 2 }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("loyalty_accounts_user_program_idx").on(t.userId, t.programId),
    check("la_club_cost_chk", sql`${t.clubMonthlyCostBrl} is null or ${t.clubMonthlyCostBrl} >= 0`),
    check("la_club_points_chk", sql`${t.clubMonthlyPoints} is null or ${t.clubMonthlyPoints} >= 0`),
    check("la_milheiro_chk", sql`${t.milheiroValueBrl} is null or ${t.milheiroValueBrl} >= 0`),
  ],
);

/**
 * Saldos ("lotes"): cada crédito gera um lote com sua validade.
 * Débitos consomem lotes em ordem FIFO de vencimento. O saldo da conta é
 * sempre a soma de `remaining` — e é igual à soma das transações.
 */
export const balances = pgTable(
  "balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
    sourceTransactionId: uuid("source_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    original: integer("original").notNull(),
    remaining: integer("remaining").notNull(),
    expiresAt: date("expires_at"),
    ...timestamps,
  },
  (t) => [
    index("balances_account_idx").on(t.accountId),
    index("balances_expires_idx").on(t.expiresAt),
    check("balances_original_chk", sql`${t.original} > 0`),
    check("balances_remaining_chk", sql`${t.remaining} >= 0 and ${t.remaining} <= ${t.original}`),
  ],
);

/* ------------------------------------------------------------------ */
/* Cartões                                                             */
/* ------------------------------------------------------------------ */

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    issuer: text("issuer").notNull(),
    name: text("name").notNull(),
    brand: cardBrand("brand").notNull(),
    annualFeeBrl: numeric("annual_fee_brl", { precision: 10, scale: 2 }).notNull().default("0"),
    pointsPerUsd: numeric("points_per_usd", { precision: 6, scale: 2 }),
    pointsPerBrl: numeric("points_per_brl", { precision: 6, scale: 2 }),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    benefits: text("benefits"),
    /** Limite cifrado com AES-256-GCM (dado financeiro sensível). */
    creditLimitEnc: text("credit_limit_enc"),
    /** Dia de vencimento da fatura (1–31). Nunca armazenamos número, CVV ou senha do cartão. */
    dueDay: smallint("due_day"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    index("cards_user_idx").on(t.userId),
    check("cards_due_day_chk", sql`${t.dueDay} is null or ${t.dueDay} between 1 and 31`),
    check("cards_fee_chk", sql`${t.annualFeeBrl} >= 0`),
    check("cards_ppu_chk", sql`${t.pointsPerUsd} is null or ${t.pointsPerUsd} >= 0`),
    check("cards_ppb_chk", sql`${t.pointsPerBrl} is null or ${t.pointsPerBrl} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Transações (histórico de movimentações)                             */
/* ------------------------------------------------------------------ */

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => loyaltyAccounts.id, { onDelete: "cascade" }),
    type: transactionType("type").notNull(),
    points: integer("points").notNull(),
    occurredOn: date("occurred_on").notNull(),
    /** Validade dos pontos creditados (somente créditos). */
    expiresAt: date("expires_at"),
    cardId: uuid("card_id").references(() => cards.id, { onDelete: "set null" }),
    /** Custo em dinheiro (compra de pontos, taxas de emissão, assinatura...). */
    costBrl: numeric("cost_brl", { precision: 12, scale: 2 }),
    /** Economia obtida em um resgate: preço em dinheiro evitado − taxas. */
    savingsBrl: numeric("savings_brl", { precision: 12, scale: 2 }),
    /** Liga as duas pernas de uma transferência entre programas. */
    transferGroupId: uuid("transfer_group_id"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tx_user_date_idx").on(t.userId, t.occurredOn),
    index("tx_account_idx").on(t.accountId),
    index("tx_card_idx").on(t.cardId),
    check("tx_points_nonzero_chk", sql`${t.points} <> 0`),
    check(
      "tx_sign_chk",
      sql`(${t.type} in ('saldo_inicial','acumulo','bonus','compra','transferencia_entrada') and ${t.points} > 0)
        or (${t.type} in ('transferencia_saida','resgate','expiracao') and ${t.points} < 0)
        or ${t.type} = 'ajuste'`,
    ),
    check("tx_cost_chk", sql`${t.costBrl} is null or ${t.costBrl} >= 0`),
    check("tx_savings_chk", sql`${t.savingsBrl} is null or ${t.type} = 'resgate'`),
  ],
);

/* ------------------------------------------------------------------ */
/* Simulações das calculadoras                                         */
/* ------------------------------------------------------------------ */

export const simulations = pgTable(
  "simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    calculator: calculatorKind("calculator").notNull(),
    title: text("title").notNull(),
    input: jsonb("input").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("simulations_user_idx").on(t.userId, t.calculator)],
);

/* ------------------------------------------------------------------ */
/* Viagens                                                             */
/* ------------------------------------------------------------------ */

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    departDate: date("depart_date"),
    returnDate: date("return_date"),
    passengers: smallint("passengers").notNull().default(1),
    cabin: cabinClass("cabin").notNull().default("economica"),
    status: tripStatus("status").notNull().default("planejada"),
    programId: uuid("program_id").references(() => programs.id, { onDelete: "set null" }),
    milesNeeded: integer("miles_needed"),
    cashPriceBrl: numeric("cash_price_brl", { precision: 12, scale: 2 }),
    notes: text("notes"),
    /** Espaço reservado para metadados do futuro agente de IA (fontes, buscas, scores). */
    aiContext: jsonb("ai_context"),
    flexibleDates: boolean("flexible_dates").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("trips_user_idx").on(t.userId),
    check("trips_pax_chk", sql`${t.passengers} between 1 and 9`),
    check("trips_dates_chk", sql`${t.returnDate} is null or ${t.departDate} is null or ${t.returnDate} >= ${t.departDate}`),
    check("trips_miles_chk", sql`${t.milesNeeded} is null or ${t.milesNeeded} > 0`),
    check("trips_cash_chk", sql`${t.cashPriceBrl} is null or ${t.cashPriceBrl} >= 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  accounts: many(loyaltyAccounts),
  cards: many(cards),
}));

export const loyaltyAccountsRelations = relations(loyaltyAccounts, ({ one, many }) => ({
  program: one(programs, { fields: [loyaltyAccounts.programId], references: [programs.id] }),
  balances: many(balances),
  transactions: many(transactions),
}));

export const balancesRelations = relations(balances, ({ one }) => ({
  account: one(loyaltyAccounts, { fields: [balances.accountId], references: [loyaltyAccounts.id] }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(loyaltyAccounts, { fields: [transactions.accountId], references: [loyaltyAccounts.id] }),
  card: one(cards, { fields: [transactions.cardId], references: [cards.id] }),
}));

export const cardsRelations = relations(cards, ({ one }) => ({
  program: one(programs, { fields: [cards.programId], references: [programs.id] }),
}));

export const tripsRelations = relations(trips, ({ one }) => ({
  program: one(programs, { fields: [trips.programId], references: [programs.id] }),
}));

/* ------------------------------------------------------------------ */
/* Agente Inteligente (Etapa 2)                                        */
/* ------------------------------------------------------------------ */

export const agentRole = pgEnum("agent_role", ["user", "assistant", "system"]);
export const agentActionKind = pgEnum("agent_action_kind", ["lancamento", "transferencia", "viagem"]);
export const agentActionStatus = pgEnum("agent_action_status", ["pendente", "confirmada", "recusada", "falhou"]);

export const agentConversations = pgTable(
  "agent_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    ...timestamps,
  },
  (t) => [index("agent_conv_user_idx").on(t.userId, t.updatedAt)],
);

/**
 * Histórico exatamente como enviado/recebido da API (blocos de conteúdo em jsonb),
 * só por acréscimo: nunca editamos mensagens antigas (requisito do "preserved thinking").
 */
export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => agentConversations.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: agentRole("role").notNull(),
    content: jsonb("content").notNull(),
    /** Uso de tokens da resposta (só mensagens do assistente). */
    usage: jsonb("usage"),
    stopReason: text("stop_reason"),
    /** Aviso exibido na interface após esta mensagem (erro, recusa). Nunca é enviado à API. */
    notice: jsonb("notice"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agent_msg_conv_seq_idx").on(t.conversationId, t.seq)],
);

/** Ações que o agente propõe. Só são executadas quando o usuário confirma na interface. */
export const agentActions = pgTable(
  "agent_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => agentConversations.id, { onDelete: "cascade" }),
    toolUseId: text("tool_use_id").notNull(),
    kind: agentActionKind("kind").notNull(),
    summary: text("summary").notNull(),
    payload: jsonb("payload").notNull(),
    status: agentActionStatus("status").notNull().default("pendente"),
    resultMessage: text("result_message"),
    /** Se a decisão já foi informada ao agente em um turno seguinte. */
    reportedToAgent: boolean("reported_to_agent").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("agent_actions_conv_idx").on(t.conversationId), index("agent_actions_user_idx").on(t.userId, t.status)],
);

/**
 * Registro de uso da API por resposta do agente, com custo estimado em US$ calculado na hora.
 * Fica separado das mensagens para que o total do mês não mude ao excluir conversas.
 */
export const agentUsage = pgTable(
  "agent_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => agentConversations.id, { onDelete: "set null" }),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("agent_usage_user_date_idx").on(t.userId, t.createdAt), index("agent_usage_conv_idx").on(t.conversationId)],
);
