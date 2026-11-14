import { describe, expect, it } from "vitest";
import { buildTripPlan, monthsToReach, receivedMiles, simulateExtra, type PlanAccount, type QuoteLite } from "@/lib/travel-plan";

const today = "2026-11-15";
const trip = { passengers: 4, tripType: "ida_volta" as const, departDate: "2027-07-01", budgetBrl: 8000 };
const q = (o: Partial<QuoteLite>): QuoteLite => ({
  id: Math.random().toString(),
  kind: "milhas",
  certainty: "real",
  programId: null,
  label: null,
  milesPerPax: null,
  taxesPerPaxBrl: null,
  cashPerPaxBrl: null,
  covers: "ida_volta",
  sourceUrl: null,
  checkedOn: today,
  ...o,
});
const acc = (o: Partial<PlanAccount>): PlanAccount => ({
  id: "a",
  programId: "p",
  programSlug: "x",
  programName: "X",
  kind: "aerea",
  unit: "milhas",
  balance: 0,
  milheiroValueBrl: null,
  monthlyAccrual: 0,
  ...o,
});
const smiles = acc({ id: "s", programId: "P_SMILES", programSlug: "smiles", programName: "Smiles", balance: 100_000, milheiroValueBrl: 18, monthlyAccrual: 5000 });
const latam = acc({ id: "l", programId: "P_LATAM", programSlug: "latam-pass", programName: "LATAM Pass", unit: "pontos", balance: 20_000, milheiroValueBrl: 25 });
const livelo = acc({ id: "v", programId: "P_LIVELO", programSlug: "livelo", programName: "Livelo", kind: "banco", unit: "pontos", balance: 50_000, milheiroValueBrl: 35, monthlyAccrual: 3000 });

describe("funções básicas", () => {
  it("milhas recebidas, meses e simulação extra", () => {
    expect(receivedMiles(50_000, 1, 1, 80)).toBe(90_000);
    expect(monthsToReach(10_001, 5000)).toBe(3);
    expect(monthsToReach(0, 0)).toBe(0);
    expect(monthsToReach(1, 0)).toBeNull();
    expect(simulateExtra({ remaining: 30_000, monthlyRate: 5000, extraSpendBrl: 2000, pointsPerBrl: 2.5, monthlyPurchase: 0 })).toEqual({ monthly: 10_000, months: 3 });
  });
});

describe("buildTripPlan: família para Orlando", () => {
  const quotes = [
    q({ programId: "P_SMILES", milesPerPax: 50_000, taxesPerPaxBrl: 300, covers: "ida" }), // só ida: dobra
    q({ programId: "P_LATAM", milesPerPax: 120_000, taxesPerPaxBrl: 250 }),
    q({ kind: "dinheiro", cashPerPaxBrl: 4500, label: "Site da companhia" }),
  ];
  const plan = buildTripPlan({ trip, quotes, accounts: [smiles, latam, livelo], promos: [], today });

  it("calcula a meta com passageiros e trechos", () => {
    const s = plan.options.find((o) => o.programId === "P_SMILES")!;
    expect(s.totalMiles).toBe(400_000); // 50 mil × 4 pax × 2 trechos
    expect(s.totalTaxesBrl).toBe(2400);
    expect(plan.legsFactorNote).toMatch(/em dobro/);
  });

  it("soma saldo direto e pontos de banco na premissa 1:1, e calcula o que falta", () => {
    const s = plan.options.find((o) => o.programId === "P_SMILES")!;
    expect(s.direct).toBe(100_000);
    expect(s.transfers[0]).toMatchObject({ programName: "Livelo", received: 50_000, bonusPct: 0, fromPromo: null });
    expect(s.available).toBe(150_000);
    expect(s.remaining).toBe(250_000);
    expect(s.progress).toBeCloseTo(0.375, 6);
    // ritmo: 5.000 Smiles + 3.000 Livelo por mês → 250.000 / 8.000 = 31,25 → 32 meses (depois do embarque)
    expect(s.scenarios[0]).toMatchObject({ name: "Ritmo atual", months: 32, onTime: false });
    expect(s.feasibleBeforeTrip).toBe(false);
  });

  it("compara com dinheiro usando o valor do milheiro", () => {
    const s = plan.options.find((o) => o.programId === "P_SMILES")!;
    // dinheiro: 4.500 × 4 = 18.000; rende (18.000 − 2.400) / 400 = R$ 39/milheiro
    expect(plan.cash!.totalBrl).toBe(18_000);
    expect(s.valuePerThousandBrl).toBeCloseTo(39, 6);
    expect(s.economicCostBrl).toBeCloseTo(2400 + 400 * 18, 6);
  });

  it("cria um cenário hipotético de transferência bonificada, sinalizado como hipótese", () => {
    const s = plan.options.find((o) => o.programId === "P_SMILES")!;
    const h = s.scenarios.find((x) => x.basis === "hipotetico")!;
    expect(h.name).toMatch(/bonificada/);
    expect(h.description).toMatch(/premissa/);
  });

  it("indica ações quando a meta não fecha antes do embarque", () => {
    expect(plan.actions.some((a) => /não chega à meta antes do embarque/.test(a.text))).toBe(true);
    expect(plan.actions.some((a) => /aguarde uma transferência bonificada/.test(a.text))).toBe(true);
  });
});

describe("buildTripPlan: promoções do Radar", () => {
  const quotes = [q({ programId: "P_SMILES", milesPerPax: 30_000, taxesPerPaxBrl: 100 }), q({ kind: "dinheiro", cashPerPaxBrl: 2000 })];
  const promos = [
    { kind: "transferencia" as const, title: "Livelo → Smiles 100%", fromSlug: "livelo", toSlug: "smiles", bonusPct: 100, ratioFrom: 1, ratioTo: 1, pricePerThousandBrl: null, endsOn: "2026-11-20" },
    { kind: "compra" as const, title: "Smiles compra", fromSlug: null, toSlug: "smiles", bonusPct: 25, ratioFrom: null, ratioTo: null, pricePerThousandBrl: 20, endsOn: "2026-11-20" },
  ];

  it("usa o bônus vigente na transferência e propõe a ação", () => {
    const plan = buildTripPlan({ trip: { ...trip, passengers: 4 }, quotes, accounts: [acc({ ...smiles, balance: 0, monthlyAccrual: 0 }), livelo], promos, today });
    const s = plan.best!;
    expect(s.transfers[0]).toMatchObject({ received: 100_000, bonusPct: 100 });
    expect(s.remaining).toBe(20_000); // 120.000 − 100.000
    expect(plan.actions.some((a) => /Promoção vigente/.test(a.text) && /irreversíveis/.test(a.text))).toBe(true);
  });

  it("só recomenda comprar quando o milheiro comprado custa menos do que rende", () => {
    const plan = buildTripPlan({ trip, quotes, accounts: [acc({ ...smiles, balance: 0, monthlyAccrual: 0 }), livelo], promos, today });
    const s = plan.best!;
    // compra efetiva: 20 / 1,25 = R$ 16; rende (8.000 − 400) / 120 = R$ 63,33 → compensa
    expect(s.purchase).toMatchObject({ pricePerThousandBrl: 16, worth: true });
    expect(s.purchase!.costBrl).toBeCloseTo(320, 6);
    const cheapCash = buildTripPlan({ trip, quotes: [quotes[0], q({ kind: "dinheiro", cashPerPaxBrl: 150 })], accounts: [acc({ ...smiles, balance: 0, monthlyAccrual: 0 }), livelo], promos, today });
    // rende (600 − 400) / 120 = R$ 1,67 < R$ 16 → não compensa
    expect(cheapCash.best!.purchase!.worth).toBe(false);
    expect(cheapCash.actions.some((a) => /não compensa/.test(a.text))).toBe(true);
  });
});

describe("buildTripPlan: decisões e transparência", () => {
  it("recomenda dinheiro quando o milheiro rende menos que o valor de referência", () => {
    const plan = buildTripPlan({
      trip: { ...trip, passengers: 1 },
      quotes: [q({ programId: "P_SMILES", milesPerPax: 40_000, taxesPerPaxBrl: 100 }), q({ kind: "dinheiro", cashPerPaxBrl: 600 })],
      accounts: [smiles],
      promos: [],
      today,
    });
    expect(plan.recommendation.kind).toBe("dinheiro"); // (600−100)/40 = R$ 12,50 < R$ 18
    expect(plan.estimatedCostBrl).toBe(600);
    expect(plan.budget).toEqual({ budgetBrl: 8000, withinBudget: true });
  });

  it("sem cotação em milhas não inventa meta e pede a cotação", () => {
    const plan = buildTripPlan({ trip, quotes: [], accounts: [smiles], promos: [], today });
    expect(plan.goalMiles).toBeNull();
    expect(plan.recommendation.kind).toBe("indefinido");
    expect(plan.actions[0].text).toMatch(/cadastre a cotação/);
  });

  it("sinaliza quando só há estimativas", () => {
    const plan = buildTripPlan({ trip, quotes: [q({ programId: "P_SMILES", milesPerPax: 10_000, certainty: "estimativa" })], accounts: [smiles], promos: [], today });
    expect(plan.onlyEstimates).toBe(true);
    expect(plan.actions.some((a) => /só estimativas/.test(a.text))).toBe(true);
  });

  it("prioriza o programa viável antes do embarque", () => {
    const plan = buildTripPlan({
      trip: { ...trip, passengers: 1, tripType: "ida" },
      quotes: [q({ programId: "P_SMILES", milesPerPax: 90_000 }), q({ programId: "P_LATAM", milesPerPax: 500_000 })],
      accounts: [smiles, latam],
      promos: [],
      today,
    });
    expect(plan.best!.programId).toBe("P_SMILES"); // 100 mil já cobrem
    expect(plan.best!.remaining).toBe(0);
    expect(plan.goalMiles).toBe(90_000);
  });
});
