import { describe, expect, it } from "vitest";
import {
  clubePontos,
  compraPontos,
  custoMilheiro,
  dinheiroVsMilhas,
  retornoCartao,
  runCalculator,
  transferencia,
} from "@/lib/calculators";
import { parseNumber } from "@/lib/validation";

describe("parseNumber", () => {
  it.each([
    ["1234.5", 1234.5],
    ["1.234,56", 1234.56],
    ["50.000", 50000],
    ["1.500.000", 1500000],
    ["2,5", 2.5],
    ["2.2", 2.2],
    ["R$ 1.750,00", 1750],
    ["", undefined],
  ])("%s → %s", (input, out) => expect(parseNumber(input)).toBe(out));
});

describe("A. custo por milheiro", () => {
  it("divide o valor pago pelos milheiros", () => {
    const r = custoMilheiro({ valorPago: 1750, pontos: 100_000 });
    expect(r.raw.custoMilheiro).toBe(17.5);
  });
  it("compara com a referência", () => {
    expect(custoMilheiro({ valorPago: 1750, pontos: 100_000, referencia: 25 }).verdict?.tone).toBe("favoravel");
    expect(custoMilheiro({ valorPago: 3000, pontos: 100_000, referencia: 25 }).verdict?.tone).toBe("desfavoravel");
  });
});

describe("B. transferência bonificada", () => {
  it("aplica paridade e bônus, arredondando para baixo", () => {
    const r = transferencia({ pontos: 50_000, paridadeOrigem: 1, paridadeDestino: 1, bonusPct: 80 });
    expect(r.raw.recebidas).toBe(90_000);
    expect(r.raw.bonus).toBe(40_000);
  });
  it("paridade 2:1 com bônus de 100%", () => {
    expect(transferencia({ pontos: 10_001, paridadeOrigem: 2, paridadeDestino: 1, bonusPct: 100 }).raw.recebidas).toBe(10_001);
  });
  it("calcula o custo efetivo do milheiro no destino", () => {
    const r = transferencia({ pontos: 50_000, paridadeOrigem: 1, paridadeDestino: 1, bonusPct: 100, custoMilheiroOrigem: 35 });
    expect(r.raw.custoMilheiroDestino).toBeCloseTo(17.5, 6);
  });
});

describe("C. compra de pontos", () => {
  it("aplica desconto e bônus", () => {
    const r = compraPontos({ pontos: 20_000, precoMilheiro: 70, descontoPct: 50, bonusPct: 100 });
    expect(r.raw.preco).toBe(700);
    expect(r.raw.total).toBe(40_000);
    expect(r.raw.custoMilheiro).toBe(17.5);
  });
});

describe("D. dinheiro x milhas", () => {
  it("recomenda milhas quando o valor obtido supera o custo do milheiro", () => {
    const r = dinheiroVsMilhas({ precoDinheiro: 1800, milhas: 60_000, taxas: 90, custoMilheiro: 20 });
    expect(r.raw.valorObtido).toBeCloseTo(28.5, 6);
    expect(r.raw.custoComMilhas).toBe(1290);
    expect(r.raw.economia).toBe(510);
    expect(r.verdict?.tone).toBe("favoravel");
  });
  it("recomenda dinheiro quando a passagem é barata", () => {
    const r = dinheiroVsMilhas({ precoDinheiro: 500, milhas: 40_000, taxas: 60, custoMilheiro: 20 });
    expect(r.raw.economia).toBeLessThan(0);
    expect(r.verdict?.tone).toBe("desfavoravel");
  });
});

describe("E. retorno anual de cartão", () => {
  it("converte pontos por dólar e desconta a anuidade", () => {
    const r = retornoCartao({ gastoMensal: 5500, pontosPorDolar: 2, cotacaoDolar: 5.5, anuidade: 1000, valorMilheiro: 25 });
    expect(r.raw.pontosAno).toBe(24_000);
    expect(r.raw.valorPontos).toBe(600);
    expect(r.raw.liquido).toBe(-400);
    // Gasto para empatar: 1000 / (2/5,5 × 25/1000) / 12
    expect(r.raw.breakEvenMensal).toBeCloseTo(9166.67, 1);
  });
  it("exige pontuação por dólar ou por real", () => {
    const res = runCalculator("retorno_cartao", { gastoMensal: "5000", cotacaoDolar: "5", anuidade: "0", valorMilheiro: "20" });
    expect(res.ok).toBe(false);
  });
});

describe("F. clube de pontos", () => {
  it("soma pontos do clube e bônus extra contra a mensalidade", () => {
    const r = clubePontos({ mensalidade: 84, pontosMensais: 2000, meses: 12, bonusExtraPct: 20, pontosTransferidos: 60_000, valorMilheiro: 16 });
    expect(r.raw.custo).toBe(1008);
    expect(r.raw.totalPontos).toBe(36_000);
    expect(r.raw.valorGerado).toBe(576);
    expect(r.raw.saldo).toBe(-432);
    expect(r.verdict?.tone).toBe("desfavoravel");
  });
});

describe("validação das entradas", () => {
  it("recusa valores negativos e zero onde não fazem sentido", () => {
    const res = runCalculator("custo_milheiro", { valorPago: "-10", pontos: "0" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.fieldErrors.valorPago).toBeDefined();
      expect(res.fieldErrors.pontos).toBeDefined();
    }
  });
  it("aceita números em formato brasileiro vindos do formulário", () => {
    const res = runCalculator("custo_milheiro", { valorPago: "1.750,00", pontos: "100.000" });
    expect(res.ok && res.result.raw.custoMilheiro).toBe(17.5);
  });
});
