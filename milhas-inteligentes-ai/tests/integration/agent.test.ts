import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { resetTestDatabase } from "../db-helpers";

let db: typeof import("@/server/db").db;
let schema: typeof import("@/server/db").schema;
let tools: typeof import("@/server/agent/tools");
let decide: typeof import("@/server/agent/decide");
let run: typeof import("@/server/agent/run");
let ledger: typeof import("@/server/services/ledger");

let userId: string;
let otherId: string;
let livelo: string;
let smiles: string;
let conversationId: string;

const ctx = (toolUseId = "toolu_1") => ({ userId, conversationId, toolUseId, alertDays: 90 });

async function balance(accountId: string) {
  const [r] = await db
    .select({ n: sql<number>`coalesce(sum(${schema.balances.remaining}),0)::int` })
    .from(schema.balances)
    .where(eq(schema.balances.accountId, accountId));
  return r.n;
}

beforeAll(async () => {
  await resetTestDatabase();
  ({ db, schema } = await import("@/server/db"));
  tools = await import("@/server/agent/tools");
  decide = await import("@/server/agent/decide");
  run = await import("@/server/agent/run");
  ledger = await import("@/server/services/ledger");

  const [u, o] = await db
    .insert(schema.users)
    .values([
      { email: "agente@teste.dev", passwordHash: "x" },
      { email: "outro@teste.dev", passwordHash: "x" },
    ])
    .returning();
  userId = u.id;
  otherId = o.id;
  await db.insert(schema.profiles).values([
    { userId, name: "A" },
    { userId: otherId, name: "B" },
  ]);
  const progs = await db.select().from(schema.programs);
  const pid = (slug: string) => progs.find((p) => p.slug === slug)!.id;
  const [a, b] = await db
    .insert(schema.loyaltyAccounts)
    .values([
      { userId, programId: pid("livelo"), milheiroValueBrl: "35.00" },
      { userId, programId: pid("smiles"), milheiroValueBrl: "16.00" },
    ])
    .returning();
  livelo = a.id;
  smiles = b.id;
  await db.transaction((tx) =>
    ledger.recordTransaction(tx, { userId, accountId: livelo, type: "saldo_inicial", points: 40_000, occurredOn: "2026-01-01" }),
  );
  conversationId = (await run.createConversation(userId, "Teste")).id;
});

describe("ferramentas de leitura", () => {
  it("consultar_programas devolve saldos por programa sem somar unidades", async () => {
    const out = await tools.executeTool("consultar_programas", {}, ctx());
    const data = JSON.parse(out.content);
    const lv = data.programas.find((p: { programa: string }) => p.programa === "Livelo");
    expect(lv.saldo).toBe(40_000);
    expect(lv.valor_estimado_brl).toBe(1400);
    expect(data).not.toHaveProperty("saldo_total");
  });

  it("consultar_cartoes nunca expõe o limite de crédito", async () => {
    await db.insert(schema.cards).values({ userId, issuer: "B", name: "C", brand: "visa", pointsPerUsd: "2", creditLimitEnc: "x.y.z" });
    const out = await tools.executeTool("consultar_cartoes", {}, ctx());
    expect(out.content).not.toMatch(/limite|credit/i);
  });

  it("calcular reutiliza as calculadoras e valida as entradas", async () => {
    const ok = await tools.executeTool(
      "calcular",
      { calculadora: "dinheiro_vs_milhas", entradas: { precoDinheiro: 1800, milhas: 60000, taxas: 90, custoMilheiro: 20 } },
      ctx(),
    );
    expect(JSON.parse(ok.content).metricas[0].value).toContain("28,50");
    const bad = await tools.executeTool("calcular", { calculadora: "custo_milheiro", entradas: { valorPago: -1 } }, ctx());
    expect(bad.isError).toBe(true);
  });

  it("rejeita entradas fora do schema (a API não valida com eager_input_streaming)", async () => {
    const out = await tools.executeTool("consultar_movimentacoes", { limite: 5000 }, ctx());
    expect(out.isError).toBe(true);
  });

  it("não enxerga dados de outro usuário", async () => {
    const out = await tools.executeTool("consultar_programas", {}, { ...ctx(), userId: otherId });
    expect(JSON.parse(out.content).programas).toHaveLength(0);
  });
});

describe("propostas e confirmação", () => {
  it("propor_lancamento não grava nada até a confirmação", async () => {
    const before = await balance(smiles);
    const out = await tools.executeTool(
      "propor_lancamento",
      { programa_id: smiles, tipo: "acumulo", pontos: 5000, data: "2026-02-01", validade: "2028-02-01" },
      ctx("toolu_launch"),
    );
    expect(out.isError).toBeFalsy();
    expect(out.actionId).toBeTruthy();
    expect(await balance(smiles)).toBe(before);

    const done = await decide.decideAction(userId, out.actionId!, "confirmar");
    expect(done.status).toBe("confirmada");
    expect(await balance(smiles)).toBe(before + 5000);
    await expect(decide.decideAction(userId, out.actionId!, "confirmar")).rejects.toThrow(/já foi decidida/);
  });

  it("recusa saldo insuficiente já na proposta", async () => {
    const out = await tools.executeTool("propor_lancamento", { programa_id: livelo, tipo: "resgate", pontos: 999_999 }, ctx());
    expect(out.isError).toBe(true);
    expect(out.content).toMatch(/Saldo insuficiente/);
  });

  it("outro usuário não confirma a proposta", async () => {
    const out = await tools.executeTool("propor_lancamento", { programa_id: livelo, tipo: "bonus", pontos: 100 }, ctx("toolu_x"));
    await expect(decide.decideAction(otherId, out.actionId!, "confirmar")).rejects.toThrow(/não encontrada/);
    const refused = await decide.decideAction(userId, out.actionId!, "recusar");
    expect(refused.status).toBe("recusada");
  });

  it("transferência confirmada aplica paridade e bônus na mesma transação", async () => {
    const out = await tools.executeTool(
      "propor_transferencia",
      { origem_id: livelo, destino_id: smiles, pontos: 10_000, paridade_origem: 1, paridade_destino: 1, bonus_pct: 100, data: "2026-03-01" },
      ctx("toolu_tr"),
    );
    const smilesBefore = await balance(smiles);
    const done = await decide.decideAction(userId, out.actionId!, "confirmar");
    expect(done.status).toBe("confirmada");
    expect(await balance(livelo)).toBe(30_000);
    expect(await balance(smiles)).toBe(smilesBefore + 20_000);
  });

  it("proposta que deixou de ser válida falha sem alterar saldos", async () => {
    const out = await tools.executeTool("propor_lancamento", { programa_id: livelo, tipo: "resgate", pontos: 30_000 }, ctx("toolu_r1"));
    // Outro débito acontece antes da confirmação.
    await db.transaction((tx) =>
      ledger.recordTransaction(tx, { userId, accountId: livelo, type: "resgate", points: -1000, occurredOn: "2026-03-02" }),
    );
    const res = await decide.decideAction(userId, out.actionId!, "confirmar");
    expect(res.status).toBe("falhou");
    expect(res.resultMessage).toMatch(/Saldo insuficiente/);
    expect(await balance(livelo)).toBe(29_000);
  });

  it("propor_viagem cadastra a viagem só após confirmar", async () => {
    const out = await tools.executeTool(
      "propor_viagem",
      { titulo: "Teste", origem: "gru", destino: "lis", ida: "2027-05-01", programa_id: smiles, milhas_necessarias: 90000 },
      ctx("toolu_trip"),
    );
    expect((await db.select().from(schema.trips)).length).toBe(0);
    await decide.decideAction(userId, out.actionId!, "confirmar");
    const [trip] = await db.select().from(schema.trips);
    expect(trip.origin).toBe("GRU");
    expect(trip.milesNeeded).toBe(90_000);
  });
});

describe("loop do agente (cliente falso da API)", () => {
  /** Simula client.beta.messages.stream: devolve respostas pré-definidas em sequência. */
  function fakeClient(responses: { content: unknown[]; stop_reason: string }[]) {
    const calls: Record<string, unknown>[] = [];
    const client = {
      beta: {
        messages: {
          stream: (params: Record<string, unknown>) => {
            // Copia: o loop relê o histórico do banco a cada iteração.
            calls.push(structuredClone(params));
            const r = responses.shift();
            if (!r) throw new Error("sem resposta simulada");
            const handlers: ((t: string) => void)[] = [];
            return {
              on: (event: string, cb: (t: string) => void) => {
                if (event === "text") handlers.push(cb);
              },
              finalMessage: async () => {
                for (const b of r.content as { type: string; text?: string }[]) if (b.type === "text") handlers.forEach((h) => h(b.text!));
                return { id: "msg", type: "message", role: "assistant", model: "m", content: r.content, stop_reason: r.stop_reason, usage: { input_tokens: 1, output_tokens: 1 } };
              },
            };
          },
        },
      },
    };
    return { client, calls };
  }

  it("executa ferramentas, persiste o histórico só por acréscimo e emite eventos", async () => {
    const conv = await run.createConversation(userId, "Quanto tenho?");
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [
          { type: "thinking", thinking: "", signature: "sig" },
          { type: "tool_use", id: "toolu_a", name: "consultar_programas", input: {} },
        ],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Você tem 29.000 pontos Livelo." }] },
    ]);
    const events: { type: string }[] = [];
    await run.runAgentTurn({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client: client as any,
      userId,
      alertDays: 90,
      conversationId: conv.id,
      text: "Quanto tenho?",
      emit: (e) => events.push(e),
    });

    expect(calls).toHaveLength(2);
    const first = calls[0];
    expect(first.model).toBe("claude-opus-5-5");
    expect(first.fallbacks).toBe("default");
    expect(first.thinking).toEqual({ type: "adaptive" });
    const firstMsgs = first.messages as { role: string }[];
    expect(firstMsgs.map((m) => m.role)).toEqual(["user", "system"]);

    // Segunda chamada: histórico anterior intacto + resultado da ferramenta.
    const second = calls[1].messages as { role: string; content: { type: string; tool_use_id?: string; signature?: string }[] }[];
    expect(second.map((m) => m.role)).toEqual(["user", "system", "assistant", "user"]);
    expect(second[2].content[0]).toMatchObject({ type: "thinking", signature: "sig" });
    expect(second[3].content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_a" });

    expect(events.map((e) => e.type)).toEqual(["tool_start", "tool_end", "text", "done"]);

    const view = await import("@/server/agent/view").then((m) => m.loadConversationView(userId, conv.id));
    expect(view!.items.map((i) => i.kind)).toEqual(["user", "assistant"]);
  });

  it("informa ao agente, no turno seguinte, as propostas decididas", async () => {
    const conv = await run.createConversation(userId, "Registre");
    const { client, calls } = fakeClient([
      {
        stop_reason: "tool_use",
        content: [{ type: "tool_use", id: "toolu_p", name: "propor_lancamento", input: { programa_id: smiles, tipo: "bonus", pontos: 700 } }],
      },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Proposta criada, aguardando sua confirmação." }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Registrado." }] },
    ]);
    const events: { type: string; action?: { id: string } }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = { client: client as any, userId, alertDays: 90, conversationId: conv.id, emit: (e: (typeof events)[number]) => events.push(e) };
    await run.runAgentTurn({ ...base, text: "Lance 700 de bônus na Smiles" });
    const action = events.find((e) => e.type === "action")!.action!;
    await decide.decideAction(userId, action.id, "confirmar");
    await run.runAgentTurn({ ...base, text: "E agora?" });
    const msgs = calls[2].messages as { role: string; content: { text?: string }[] }[];
    const lastSystem = msgs[msgs.length - 1];
    expect(lastSystem.role).toBe("system");
    expect(lastSystem.content[0].text).toMatch(/confirmada/);
  });

  it("recusa (refusal) encerra o turno com aviso", async () => {
    const conv = await run.createConversation(userId, "x");
    const { client } = fakeClient([{ stop_reason: "refusal", content: [] }]);
    const events: { type: string }[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await run.runAgentTurn({ client: client as any, userId, alertDays: 90, conversationId: conv.id, text: "x", emit: (e) => events.push(e) });
    expect(events.map((e) => e.type)).toEqual(["notice", "done"]);
  });
});
