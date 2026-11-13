import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/server/db";
import { listAccounts, listLots } from "@/server/services/accounts";
import { listCards } from "@/server/services/cards";
import { listTrips } from "@/server/services/trips";
import { computeAlerts } from "@/server/services/alerts";
import { CREDIT_TYPES, transferReceived, type TransactionType } from "@/server/services/ledger";
import { CALCULATORS, runCalculator, type CalculatorKey } from "@/lib/calculators";
import { CALC_META } from "@/lib/calculators/fields";
import { addDaysISO, diffDays, todayISO } from "@/lib/dates";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";
import { CABIN_LABEL, TX_LABEL } from "@/lib/labels";

export type ToolContext = { userId: string; conversationId: string; toolUseId: string; alertDays: number };

/** Resultado de uma ferramenta: texto para o modelo + (opcional) ação criada para a interface. */
export type ToolOutput = { content: string; isError?: boolean; actionId?: string };

type ToolDef<S extends z.ZodType> = {
  name: string;
  /** Rótulo curto exibido na interface enquanto a ferramenta roda. */
  label: string;
  description: string;
  input: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolOutput>;
};

const def = <S extends z.ZodType>(d: ToolDef<S>) => d;
const json = (v: unknown): ToolOutput => ({ content: JSON.stringify(v) });
const fail = (msg: string): ToolOutput => ({ content: msg, isError: true });

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD.");
const uuidStr = z.string().uuid();

async function ownAccount(userId: string, accountId: string) {
  const accounts = await listAccounts(userId);
  return accounts.find((a) => a.id === accountId);
}

/* ------------------------------------------------------------------ */
/* Leitura                                                             */
/* ------------------------------------------------------------------ */

const consultarProgramas = def({
  name: "consultar_programas",
  label: "Consultou seus programas",
  description:
    "Lista os programas de fidelidade da pessoa com saldo atual (na unidade de cada programa), valor do milheiro definido por ela, valor estimado em R$, clube assinado, pontos que vencem na janela de alerta e próxima validade. Use antes de responder qualquer pergunta sobre saldos.",
  input: z.object({}),
  run: async (_, ctx) => {
    const accounts = await listAccounts(ctx.userId, ctx.alertDays);
    return json({
      janela_alerta_dias: ctx.alertDays,
      programas: accounts.map((a) => ({
        programa_id: a.id,
        programa: a.programName,
        tipo: a.kind,
        unidade: a.unit,
        saldo: a.balance,
        valor_milheiro_brl: a.milheiroValueBrl,
        valor_estimado_brl: a.estimatedValueBrl == null ? null : Math.round(a.estimatedValueBrl * 100) / 100,
        clube: a.clubName,
        clube_mensalidade_brl: a.clubMonthlyCostBrl,
        clube_pontos_mensais: a.clubMonthlyPoints,
        vencendo_na_janela: a.expiringSoon,
        proxima_validade: a.nextExpiry,
        vencidos_nao_baixados: a.expiredNotWrittenOff,
      })),
    });
  },
});

const consultarVencimentos = def({
  name: "consultar_vencimentos",
  label: "Consultou vencimentos",
  description:
    "Lista os lotes de pontos com saldo disponível e validade até N dias a partir de hoje (inclui lotes já vencidos e não baixados). Cada lote tem programa, pontos restantes e data de validade.",
  input: z.object({ dias: z.number().int().min(1).max(730).optional().describe("Horizonte em dias. Padrão: janela de alerta da pessoa.") }),
  run: async ({ dias }, ctx) => {
    const today = todayISO();
    const limit = addDaysISO(today, dias ?? ctx.alertDays);
    const lots = (await listLots(ctx.userId)).filter((l) => l.expiresAt && l.expiresAt <= limit);
    return json({
      hoje: today,
      ate: limit,
      lotes: lots.map((l) => ({
        programa_id: l.accountId,
        programa: l.programName,
        unidade: l.unit,
        pontos_restantes: l.remaining,
        validade: l.expiresAt,
        dias_ate_vencer: diffDays(today, l.expiresAt!),
      })),
    });
  },
});

const consultarMovimentacoes = def({
  name: "consultar_movimentacoes",
  label: "Consultou movimentações",
  description:
    "Lista movimentações (acúmulos, bônus, compras, transferências, resgates, expirações, ajustes), da mais recente para a mais antiga. Pontos positivos são créditos e negativos são débitos, na unidade do programa.",
  input: z.object({
    programa_id: uuidStr.optional().describe("Filtra por programa (programa_id de consultar_programas)."),
    tipo: z.enum(schema.transactionType.enumValues).optional(),
    desde: isoDate.optional(),
    ate: isoDate.optional(),
    limite: z.number().int().min(1).max(100).optional().describe("Padrão 30."),
  }),
  run: async (i, ctx) => {
    const t = schema.transactions;
    const where: SQL[] = [eq(t.userId, ctx.userId)];
    if (i.programa_id) where.push(eq(t.accountId, i.programa_id));
    if (i.tipo) where.push(eq(t.type, i.tipo));
    if (i.desde) where.push(gte(t.occurredOn, i.desde));
    if (i.ate) where.push(lte(t.occurredOn, i.ate));
    const rows = await db
      .select({
        data: t.occurredOn,
        tipo: t.type,
        pontos: t.points,
        programa: schema.programs.name,
        unidade: schema.programs.unit,
        validade: t.expiresAt,
        custo_brl: t.costBrl,
        economia_brl: t.savingsBrl,
        descricao: t.description,
        cartao: schema.cards.name,
      })
      .from(t)
      .innerJoin(schema.loyaltyAccounts, eq(schema.loyaltyAccounts.id, t.accountId))
      .innerJoin(schema.programs, eq(schema.programs.id, schema.loyaltyAccounts.programId))
      .leftJoin(schema.cards, eq(schema.cards.id, t.cardId))
      .where(and(...where))
      .orderBy(desc(t.occurredOn), desc(t.createdAt))
      .limit(i.limite ?? 30);
    return json({
      movimentacoes: rows.map((r) => ({
        ...r,
        custo_brl: r.custo_brl == null ? null : Number(r.custo_brl),
        economia_brl: r.economia_brl == null ? null : Number(r.economia_brl),
      })),
    });
  },
});

const consultarCartoes = def({
  name: "consultar_cartoes",
  label: "Consultou seus cartões",
  description:
    "Lista os cartões de crédito cadastrados: banco, nome, bandeira, anuidade, pontos por dólar ou por real, programa de destino dos pontos, benefícios e dia de vencimento da fatura. Não inclui limite de crédito.",
  input: z.object({}),
  run: async (_, ctx) => {
    const cards = await listCards(ctx.userId);
    return json({
      cartoes: cards.map((c) => ({
        cartao_id: c.id,
        banco: c.issuer,
        nome: c.name,
        bandeira: c.brand,
        anuidade_brl: c.annualFeeBrl,
        pontos_por_dolar: c.pointsPerUsd,
        pontos_por_real: c.pointsPerBrl,
        programa: c.programName,
        beneficios: c.benefits,
        dia_vencimento_fatura: c.dueDay,
      })),
    });
  },
});

const consultarViagens = def({
  name: "consultar_viagens",
  label: "Consultou suas viagens",
  description: "Lista as viagens planejadas ou emitidas: origem, destino, datas, passageiros, cabine, programa escolhido, milhas necessárias e preço em dinheiro.",
  input: z.object({}),
  run: async (_, ctx) => {
    const rows = await listTrips(ctx.userId);
    return json({
      viagens: rows.map(({ trip, programName }) => ({
        titulo: trip.title,
        origem: trip.origin,
        destino: trip.destination,
        ida: trip.departDate,
        volta: trip.returnDate,
        passageiros: trip.passengers,
        cabine: trip.cabin,
        situacao: trip.status,
        programa: programName,
        milhas_necessarias: trip.milesNeeded,
        preco_dinheiro_brl: trip.cashPriceBrl == null ? null : Number(trip.cashPriceBrl),
        datas_flexiveis: trip.flexibleDates,
        observacoes: trip.notes,
      })),
    });
  },
});

const consultarAlertas = def({
  name: "consultar_alertas",
  label: "Consultou alertas",
  description: "Lista os alertas ativos calculados pela plataforma: pontos vencendo ou vencidos, clubes deficitários, viagens sem saldo suficiente e cadastros incompletos.",
  input: z.object({}),
  run: async (_, ctx) => {
    const alerts = await computeAlerts(ctx.userId, ctx.alertDays);
    return json({ alertas: alerts.map((a) => ({ gravidade: a.severity, titulo: a.title, detalhe: a.description })) });
  },
});

const calcKeys = Object.keys(CALCULATORS) as [CalculatorKey, ...CalculatorKey[]];
const calcDoc = calcKeys
  .map((k) => {
    const m = CALC_META[k];
    const fields = m.fields.map((f) => `${f.name}${f.optional ? " (opcional)" : ""}: ${f.label}`).join("; ");
    return `- ${k}: ${m.description} Entradas: ${fields}.`;
  })
  .join("\n");

const calcular = def({
  name: "calcular",
  label: "Fez um cálculo",
  description: `Executa uma das calculadoras da plataforma com validação e devolve métricas, veredito e o passo a passo. Valores em R$ e pontos como números (ponto decimal). Calculadoras:\n${calcDoc}`,
  input: z.object({
    calculadora: z.enum(calcKeys),
    entradas: z.record(z.string(), z.number()).describe("Objeto com as entradas da calculadora, pelos nomes listados."),
  }),
  run: async ({ calculadora, entradas }) => {
    const res = runCalculator(calculadora, Object.fromEntries(Object.entries(entradas).map(([k, v]) => [k, String(v)])));
    if (!res.ok) return fail(`Entradas inválidas: ${JSON.stringify(res.fieldErrors)}`);
    return json({
      calculadora: CALC_META[calculadora].title,
      metricas: res.result.metrics,
      veredito: res.result.verdict ?? null,
      passo_a_passo: res.result.explanation,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Propostas (não gravam nada até a pessoa confirmar)                  */
/* ------------------------------------------------------------------ */

const LAUNCH_TYPES = ["acumulo", "bonus", "compra", "resgate", "expiracao", "ajuste"] as const;

async function createAction(ctx: ToolContext, kind: "lancamento" | "transferencia" | "viagem", summary: string, payload: unknown) {
  const [a] = await db
    .insert(schema.agentActions)
    .values({ userId: ctx.userId, conversationId: ctx.conversationId, toolUseId: ctx.toolUseId, kind, summary, payload })
    .returning({ id: schema.agentActions.id });
  return {
    content: JSON.stringify({
      status: "aguardando_confirmacao",
      proposta: summary,
      observacao: "Nada foi gravado. A pessoa verá um cartão para confirmar ou recusar.",
    }),
    actionId: a.id,
  } satisfies ToolOutput;
}

export const launchPayload = z.object({
  accountId: uuidStr,
  type: z.enum(LAUNCH_TYPES),
  points: z.number().int().refine((n) => n !== 0, "Não pode ser zero."),
  occurredOn: isoDate,
  expiresAt: isoDate.nullable(),
  cardId: uuidStr.nullable(),
  costBrl: z.number().nonnegative().nullable(),
  savingsBrl: z.number().nullable(),
  description: z.string().max(200).nullable(),
});

const proporLancamento = def({
  name: "propor_lancamento",
  label: "Preparou um lançamento",
  description:
    "Propõe registrar uma movimentação em um programa (acúmulo, bônus, compra de pontos, resgate, expiração ou ajuste). Não grava nada: cria uma proposta para a pessoa confirmar. Informe a quantidade sempre positiva; o sinal é definido pelo tipo (resgate e expiração debitam; ajuste usa o campo direcao).",
  input: z.object({
    programa_id: uuidStr.describe("programa_id de consultar_programas."),
    tipo: z.enum(LAUNCH_TYPES),
    pontos: z.number().int().positive(),
    direcao: z.enum(["entrada", "saida"]).optional().describe("Só para ajuste."),
    data: isoDate.optional().describe("Padrão: hoje. Não pode ser futura."),
    validade: isoDate.optional().describe("Validade dos pontos creditados."),
    cartao_id: uuidStr.optional().describe("Só para acúmulo com cartão (cartao_id de consultar_cartoes)."),
    custo_brl: z.number().nonnegative().optional().describe("Valor pago (compra) ou taxas (resgate)."),
    economia_brl: z.number().optional().describe("Só para resgate: preço em dinheiro evitado menos taxas."),
    descricao: z.string().max(200).optional(),
  }),
  run: async (i, ctx) => {
    const acc = await ownAccount(ctx.userId, i.programa_id);
    if (!acc) return fail("programa_id não encontrado. Consulte consultar_programas.");
    const today = todayISO();
    const date = i.data ?? today;
    if (date > today) return fail("A data não pode estar no futuro.");
    const type = i.tipo as TransactionType;
    const credit = CREDIT_TYPES.includes(type) || (type === "ajuste" && i.direcao !== "saida");
    if (type === "ajuste" && !i.direcao) return fail("Para ajuste, informe direcao: entrada ou saida.");
    if (!credit && i.validade) return fail("Validade só se aplica a créditos.");
    if (i.economia_brl != null && type !== "resgate") return fail("economia_brl só se aplica a resgates.");
    if (i.cartao_id && type !== "acumulo") return fail("cartao_id só se aplica a acúmulos.");
    if (i.cartao_id && !(await listCards(ctx.userId, i.cartao_id)).length) return fail("cartao_id não encontrado.");
    if (!credit && i.pontos > acc.balance) {
      return fail(`Saldo insuficiente em ${acc.programName}: disponível ${formatPoints(acc.balance)} ${acc.unit}.`);
    }
    const payload: z.infer<typeof launchPayload> = {
      accountId: acc.id,
      type: i.tipo,
      points: credit ? i.pontos : -i.pontos,
      occurredOn: date,
      expiresAt: credit ? (i.validade ?? null) : null,
      cardId: i.cartao_id ?? null,
      costBrl: i.custo_brl ?? null,
      savingsBrl: type === "resgate" ? (i.economia_brl ?? null) : null,
      description: i.descricao ?? null,
    };
    const parts = [
      `${TX_LABEL[type]} de ${credit ? "+" : "−"}${formatPoints(i.pontos)} ${acc.unit} em ${acc.programName}`,
      `em ${formatDate(date)}`,
      payload.expiresAt && `validade ${formatDate(payload.expiresAt)}`,
      payload.costBrl != null && `custo ${formatBRL(payload.costBrl)}`,
      payload.savingsBrl != null && `economia ${formatBRL(payload.savingsBrl)}`,
      payload.description,
    ].filter(Boolean);
    return createAction(ctx, "lancamento", parts.join(" · "), payload);
  },
});

export const transferPayload = z.object({
  fromAccountId: uuidStr,
  toAccountId: uuidStr,
  points: z.number().int().positive(),
  ratio: z.number().positive(),
  ratioLabel: z.string(),
  bonusPct: z.number().min(0).max(1000),
  occurredOn: isoDate,
  expiresAt: isoDate.nullable(),
});

const proporTransferencia = def({
  name: "propor_transferencia",
  label: "Preparou uma transferência",
  description:
    "Propõe registrar uma transferência de pontos entre dois programas da pessoa, com paridade e bônus. Não grava nada nem executa a transferência no programa: cria uma proposta para a pessoa confirmar o registro. Use só com paridade e bônus informados pela pessoa.",
  input: z.object({
    origem_id: uuidStr,
    destino_id: uuidStr,
    pontos: z.number().int().positive().describe("Pontos enviados pela origem."),
    paridade_origem: z.number().positive().describe("Ex.: em 2:1 use 2."),
    paridade_destino: z.number().positive().describe("Ex.: em 2:1 use 1."),
    bonus_pct: z.number().min(0).max(1000),
    data: isoDate.optional(),
    validade_destino: isoDate.optional(),
  }),
  run: async (i, ctx) => {
    if (i.origem_id === i.destino_id) return fail("Origem e destino devem ser diferentes.");
    const [from, to] = await Promise.all([ownAccount(ctx.userId, i.origem_id), ownAccount(ctx.userId, i.destino_id)]);
    if (!from || !to) return fail("Programa de origem ou destino não encontrado.");
    if (i.pontos > from.balance) return fail(`Saldo insuficiente em ${from.programName}: ${formatPoints(from.balance)} ${from.unit}.`);
    const today = todayISO();
    const date = i.data ?? today;
    if (date > today) return fail("A data não pode estar no futuro.");
    const ratio = i.paridade_destino / i.paridade_origem;
    const received = transferReceived(i.pontos, ratio, i.bonus_pct);
    if (received <= 0) return fail("A transferência resultaria em zero pontos.");
    const payload: z.infer<typeof transferPayload> = {
      fromAccountId: from.id,
      toAccountId: to.id,
      points: i.pontos,
      ratio,
      ratioLabel: `${i.paridade_origem}:${i.paridade_destino}`,
      bonusPct: i.bonus_pct,
      occurredOn: date,
      expiresAt: i.validade_destino ?? null,
    };
    const summary = `Transferência de ${formatPoints(i.pontos)} ${from.unit} de ${from.programName} para ${to.programName} · paridade ${payload.ratioLabel} · bônus ${i.bonus_pct}% · ${formatPoints(received)} ${to.unit} recebidos · ${formatDate(date)}`;
    return createAction(ctx, "transferencia", summary, payload);
  },
});

export const tripPayload = z.object({
  title: z.string().min(1).max(80),
  origin: z.string().min(2).max(60),
  destination: z.string().min(2).max(60),
  departDate: isoDate.nullable(),
  returnDate: isoDate.nullable(),
  passengers: z.number().int().min(1).max(9),
  cabin: z.enum(schema.cabinClass.enumValues),
  programId: uuidStr.nullable(),
  milesNeeded: z.number().int().positive().nullable(),
  cashPriceBrl: z.number().nonnegative().nullable(),
  notes: z.string().max(1000).nullable(),
});

const proporViagem = def({
  name: "propor_viagem",
  label: "Preparou uma viagem",
  description: "Propõe cadastrar uma viagem no Planejador de Viagens. Não grava nada: cria uma proposta para a pessoa confirmar.",
  input: z.object({
    titulo: z.string().min(1).max(80),
    origem: z.string().min(2).max(60).describe("Código IATA ou cidade."),
    destino: z.string().min(2).max(60),
    ida: isoDate.optional(),
    volta: isoDate.optional(),
    passageiros: z.number().int().min(1).max(9).optional(),
    cabine: z.enum(schema.cabinClass.enumValues).optional(),
    programa_id: uuidStr.optional().describe("programa_id de consultar_programas, se já houver programa escolhido."),
    milhas_necessarias: z.number().int().positive().optional(),
    preco_dinheiro_brl: z.number().nonnegative().optional(),
    observacoes: z.string().max(1000).optional(),
  }),
  run: async (i, ctx) => {
    if (i.ida && i.volta && i.volta < i.ida) return fail("A volta deve ser depois da ida.");
    let programId: string | null = null;
    let programName: string | null = null;
    if (i.programa_id) {
      const acc = await ownAccount(ctx.userId, i.programa_id);
      if (!acc) return fail("programa_id não encontrado.");
      programId = acc.programId;
      programName = acc.programName;
    }
    const iata = (s: string) => (/^[a-z]{3}$/i.test(s) ? s.toUpperCase() : s);
    const payload: z.infer<typeof tripPayload> = {
      title: i.titulo,
      origin: iata(i.origem),
      destination: iata(i.destino),
      departDate: i.ida ?? null,
      returnDate: i.volta ?? null,
      passengers: i.passageiros ?? 1,
      cabin: i.cabine ?? "economica",
      programId,
      milesNeeded: i.milhas_necessarias ?? null,
      cashPriceBrl: i.preco_dinheiro_brl ?? null,
      notes: i.observacoes ?? null,
    };
    const summary = [
      `Viagem "${payload.title}": ${payload.origin} → ${payload.destination}`,
      payload.departDate && `ida ${formatDate(payload.departDate)}`,
      payload.returnDate && `volta ${formatDate(payload.returnDate)}`,
      `${payload.passengers} passageiro(s), ${CABIN_LABEL[payload.cabin]}`,
      programName && `emissão com ${programName}`,
      payload.milesNeeded && `${formatPoints(payload.milesNeeded)} milhas`,
      payload.cashPriceBrl != null && `${formatBRL(payload.cashPriceBrl)} em dinheiro`,
    ]
      .filter(Boolean)
      .join(" · ");
    return createAction(ctx, "viagem", summary, payload);
  },
});

/* ------------------------------------------------------------------ */
/* Registro                                                            */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS: ToolDef<any>[] = [
  consultarProgramas,
  consultarVencimentos,
  consultarMovimentacoes,
  consultarCartoes,
  consultarViagens,
  consultarAlertas,
  calcular,
  proporLancamento,
  proporTransferencia,
  proporViagem,
];

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(TOOLS.map((t) => [t.name, t.label]));

/** Definições enviadas à API, em ordem fixa (a ordem estável preserva o cache do prompt). */
export const toolDefinitions: Anthropic.Beta.BetaTool[] = TOOLS.map((t) => {
  const { $schema: _ignored, ...schemaJson } = z.toJSONSchema(t.input) as Record<string, unknown>;
  void _ignored;
  return {
    name: t.name,
    description: t.description,
    input_schema: { ...(schemaJson as object), type: "object" } as Anthropic.Beta.BetaTool.InputSchema,
    eager_input_streaming: true,
  };
});

/** Valida a entrada (a API não valida com eager_input_streaming) e executa a ferramenta. */
export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutput> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return fail(`Ferramenta desconhecida: ${name}`);
  const parsed = tool.input.safeParse(input ?? {});
  if (!parsed.success) return fail(`Entrada inválida para ${name}: ${JSON.stringify(z.flattenError(parsed.error))}`);
  try {
    return await tool.run(parsed.data, ctx);
  } catch (e) {
    console.error(`agent tool ${name} failed`, e);
    return fail("Erro interno ao executar a ferramenta.");
  }
}

