import { describe, expect, it } from "vitest";
import { placeCodes, searchPlaces } from "@/lib/airports";
import { alertWindow, matchesAlert, mismatch, monthOptions, wouldHaveFired, type AlertCriteria, type DealLite } from "@/lib/flight-alerts";

const base: AlertCriteria = { originCodes: [], destinationCodes: [], dateMode: "qualquer", cabin: "qualquer", pay: "qualquer" };
const deal: DealLite = { origin: "CGH", destination: "AJU", kind: "milhas", miles: 30500, cashBrl: null, cabin: "economica", dateFrom: "2027-04-19", dateTo: "2027-04-19" };

describe("lugares dos avisos", () => {
  it("acha região, estado, cidade com vários aeroportos e código", () => {
    expect(searchPlaces("sudeste")[0]).toMatchObject({ kind: "regiao", label: "Região Sudeste" });
    expect(searchPlaces("sudeste")[0].codes).toEqual(expect.arrayContaining(["GRU", "CGH", "GIG", "CNF", "VIX"]));
    expect(searchPlaces("Sao Paulo").map((p) => p.label)).toContain("São Paulo (todos: GRU, CGH)");
    expect(searchPlaces("gru")[0]).toMatchObject({ kind: "aeroporto", codes: ["GRU"] });
    expect(searchPlaces("europa")[0].codes).toEqual(expect.arrayContaining(["LIS", "CDG", "MAD"]));
    expect(searchPlaces("xyz")[0]).toMatchObject({ kind: "codigo", codes: ["XYZ"] });
    expect(searchPlaces("a")).toEqual([]);
  });

  it("une códigos sem repetir", () => {
    const sp = searchPlaces("São Paulo (SP)")[0];
    expect(placeCodes([sp, ...searchPlaces("gru").slice(0, 1)]).filter((c) => c === "GRU")).toHaveLength(1);
  });
});

describe("regra dos avisos", () => {
  it("qualquer lugar e data dispara", () => {
    expect(matchesAlert(base, deal, "2026-11-17")).toBe(true);
  });

  it("filtra origem, destino, pagamento e cabine", () => {
    expect(mismatch({ ...base, originCodes: ["GRU"] }, deal, "2026-11-17")).toBe("origem");
    expect(mismatch({ ...base, originCodes: ["GRU", "CGH"], destinationCodes: ["SSA"] }, deal, "2026-11-17")).toBe("destino");
    expect(mismatch({ ...base, pay: "dinheiro" }, deal, "2026-11-17")).toBe("pagamento");
    expect(mismatch({ ...base, cabin: "executiva" }, deal, "2026-11-17")).toBe("cabine");
    expect(mismatch({ ...base, cabin: "executiva" }, { ...deal, cabin: "primeira" }, "2026-11-17")).toBeNull();
    expect(mismatch({ ...base, cabin: "economica" }, { ...deal, cabin: null }, "2026-11-17")).toBeNull();
  });

  it("janela de datas: mês, próximos dias e período divulgado", () => {
    expect(alertWindow({ ...base, dateMode: "mes", month: "2027-02" }, "2026-11-17")).toEqual({ from: "2027-02-01", to: "2027-02-28" });
    expect(mismatch({ ...base, dateMode: "mes", month: "2027-04" }, deal, "2026-11-17")).toBeNull();
    expect(mismatch({ ...base, dateMode: "mes", month: "2027-03" }, deal, "2026-11-17")).toBe("data");
    expect(mismatch({ ...base, dateMode: "prox30" }, deal, "2026-11-17")).toBe("data");
    expect(mismatch({ ...base, dateMode: "prox30" }, deal, "2027-04-01")).toBeNull();
    // Período de embarque que cruza a janela.
    expect(mismatch({ ...base, dateMode: "mes", month: "2027-03" }, { ...deal, dateFrom: "2027-02-10", dateTo: "2027-03-05" }, "2026-11-17")).toBeNull();
    // Sem data divulgada não confirma uma janela.
    expect(mismatch({ ...base, dateMode: "prox90" }, { ...deal, dateFrom: null, dateTo: null }, "2026-11-17")).toBe("data");
  });

  it("teto de milhas e de dinheiro", () => {
    expect(mismatch({ ...base, maxMiles: 30000 }, deal, "2026-11-17")).toBe("preco");
    expect(mismatch({ ...base, maxMiles: 31000 }, deal, "2026-11-17")).toBeNull();
    const cash: DealLite = { ...deal, kind: "dinheiro", miles: null, cashBrl: 899 };
    expect(mismatch({ ...base, maxCashBrl: 800 }, cash, "2026-11-17")).toBe("preco");
    expect(mismatch({ ...base, maxCashBrl: 800, maxMiles: 10000 }, { ...cash, cashBrl: 700 }, "2026-11-17")).toBeNull();
  });

  it("conta quantas vezes teria tocado nos últimos 30 dias", () => {
    const deals = [
      { ...deal, foundOn: "2026-11-10" },
      { ...deal, foundOn: "2026-10-01" },
      { ...deal, origin: "GRU", foundOn: "2026-11-15" },
    ];
    expect(wouldHaveFired({ ...base, originCodes: ["CGH"] }, deals, "2026-11-17")).toBe(1);
    expect(wouldHaveFired(base, deals, "2026-11-17")).toBe(2);
  });

  it("botões de mês começam no mês seguinte e mostram o ano só quando muda", () => {
    expect(monthOptions("2026-11-17", 3)).toEqual([
      { value: "2026-12", label: "Dezembro" },
      { value: "2027-01", label: "Janeiro 2027" },
      { value: "2027-02", label: "Fevereiro 2027" },
    ]);
  });
});

import { dealHeadline, dealInsight, milesShort } from "@/lib/flight-deal";

describe("cartão de voo com os saldos", () => {
  const accounts = [
    { programSlug: "smiles", programName: "Smiles", kind: "aerea", unit: "milhas", balance: 20000, milheiroValueBrl: 16 },
    { programSlug: "livelo", programName: "Livelo", kind: "banco", unit: "pontos", balance: 50000, milheiroValueBrl: 30 },
  ];
  const d = { origin: "CGH", destination: "AJU", kind: "milhas" as const, programSlug: "smiles", programName: "Smiles", miles: 30500, taxesBrl: "62.00", cashBrl: null, roundTrip: false, dateFrom: "2027-04-19", dateTo: "2027-04-19" };

  it("faltam milhas, mas o banco cobre por transferência; custo pelo milheiro com taxas", () => {
    const i = dealInsight(d, accounts);
    expect(i.tone).toBe("good");
    expect(i.lines[0]).toMatch(/Faltam 10\.500: seus 50\.000 pontos Livelo cobrem por transferência \(premissa 1:1/);
    expect(i.lines[1]).toMatch(/~R\$\s?550,00 com taxas/);
  });

  it("saldo suficiente, sem conta e taxas não informadas", () => {
    expect(dealInsight({ ...d, miles: 9000 }, accounts).lines[0]).toMatch(/Você já pode emitir/);
    expect(dealInsight({ ...d, programSlug: "latam-pass", programName: "LATAM Pass" }, accounts).lines[0]).toMatch(/não tem conta LATAM Pass/);
    expect(dealInsight({ ...d, taxesBrl: null }, accounts).lines[1]).toMatch(/taxas não informadas/);
    expect(dealInsight({ ...d, miles: 90000 }, accounts)).toMatchObject({ tone: "warning" });
  });

  it("textos curtos", () => {
    expect(milesShort(30500)).toBe("30,5k");
    expect(milesShort(120000)).toBe("120k");
    expect(dealHeadline(d).route).toBe("CGH (São Paulo) → AJU (Aracaju)");
    expect(dealHeadline(d).price).toMatch(/^30\.500 milhas Smiles \+ R\$\s?62,00 de taxas$/);
  });
});
