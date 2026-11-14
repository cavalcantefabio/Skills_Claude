import { describe, expect, it } from "vitest";
import { monthlyBalances, bucketByMonth } from "@/lib/series";
import { addDaysISO, diffDays, monthEnd, monthRange } from "@/lib/dates";
import { formatCompact, formatDate, monthLabel } from "@/lib/format";

describe("datas", () => {
  it("gera intervalos de meses atravessando o ano", () => {
    expect(monthRange("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("calcula fim de mês, inclusive fevereiro bissexto", () => {
    expect(monthEnd("2028-02")).toBe("2028-02-29");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
  });
  it("soma e diferença de dias", () => {
    expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
    expect(diffDays("2026-01-01", "2026-03-01")).toBe(59);
  });
});

describe("formatação", () => {
  it("formata datas e meses em pt-BR", () => {
    expect(formatDate("2026-03-05")).toBe("05/03/2026");
    expect(monthLabel("2026-03")).toBe("mar/26");
  });
  it("compacta números para eixos", () => {
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(12_500)).toBe("13 mil");
    expect(formatCompact(2_400_000)).toBe("2,4 mi");
  });
});

describe("monthlyBalances", () => {
  const txs = [
    { accountId: "a", points: 1000, occurredOn: "2025-12-15" },
    { accountId: "a", points: 500, occurredOn: "2026-01-10" },
    { accountId: "b", points: 300, occurredOn: "2026-02-01" },
    { accountId: "a", points: -200, occurredOn: "2026-02-20" },
  ];
  it("usa o saldo anterior ao período como abertura e mantém contas separadas", () => {
    const rows = monthlyBalances(txs, ["2026-01", "2026-02", "2026-03"], ["a", "b"]);
    expect(rows).toEqual([
      { month: "2026-01", a: 1500, b: 0 },
      { month: "2026-02", a: 1300, b: 300 },
      { month: "2026-03", a: 1300, b: 300 },
    ]);
  });
  it("agrupa valores por mês ignorando os fora do intervalo", () => {
    const out = bucketByMonth(txs, ["2026-01", "2026-02"], (t) => t.occurredOn, (t) => t.points);
    expect(out).toEqual([
      { month: "2026-01", value: 500 },
      { month: "2026-02", value: 100 },
    ]);
  });
});
