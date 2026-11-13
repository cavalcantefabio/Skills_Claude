/**
 * Calculadoras de milhas — funções puras, sem I/O.
 * Cada uma recebe entradas já validadas e devolve números + explicação em texto.
 * São reutilizáveis pela interface, pelos testes e pelo futuro agente de IA.
 */
import { z } from "zod";
import { formatBRL, formatDecimal, formatPct, formatPoints } from "@/lib/format";
import { parseNumber } from "@/lib/validation";

const num = (label: string, min = 0, max = 1e9) =>
  z.preprocess(
    parseNumber,
    z
      .number({ error: `Informe ${label}.` })
      .min(min, `${label[0].toUpperCase()}${label.slice(1)}: mínimo ${formatDecimal(min)}.`)
      .max(max, `${label[0].toUpperCase()}${label.slice(1)}: valor muito alto.`),
  );
const pos = (label: string, max = 1e9) =>
  num(label, 0, max).refine((v) => v > 0, `${label[0].toUpperCase()}${label.slice(1)} deve ser maior que zero.`);
const opt = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

export type Verdict = "favoravel" | "neutro" | "desfavoravel";
export type CalcResult = {
  /** Valores exibidos em destaque, na ordem. */
  metrics: { label: string; value: string; emphasis?: boolean }[];
  verdict?: { tone: Verdict; text: string };
  /** Passo a passo do cálculo, em linguagem simples. */
  explanation: string[];
  /** Números crus, para salvar a simulação e para uso programático. */
  raw: Record<string, number>;
};

/** Custo por milheiro: quanto se pagou por cada 1.000 pontos. */
export const milheiroCost = (totalBrl: number, points: number) => (points > 0 ? totalBrl / (points / 1000) : 0);

/* ------------------------------------------------------------------ */
/* A. Custo por milheiro                                               */
/* ------------------------------------------------------------------ */

export const custoMilheiroSchema = z.object({
  valorPago: pos("o valor pago (R$)"),
  pontos: pos("a quantidade de pontos", 1e9),
  referencia: opt(pos("o valor de referência do milheiro (R$)", 1e4)),
});

export function custoMilheiro(i: z.infer<typeof custoMilheiroSchema>): CalcResult {
  const custo = milheiroCost(i.valorPago, i.pontos);
  const explanation = [
    `Milheiros adquiridos: ${formatPoints(i.pontos)} ÷ 1.000 = ${formatDecimal(i.pontos / 1000)}.`,
    `Custo por milheiro: ${formatBRL(i.valorPago)} ÷ ${formatDecimal(i.pontos / 1000)} = ${formatBRL(custo)}.`,
  ];
  let verdict: CalcResult["verdict"];
  if (i.referencia) {
    const diff = (custo - i.referencia) / i.referencia;
    explanation.push(
      `Comparado à sua referência de ${formatBRL(i.referencia)}, o custo está ${formatPct(Math.abs(diff))} ${diff <= 0 ? "abaixo" : "acima"}.`,
    );
    verdict =
      diff <= -0.05
        ? { tone: "favoravel", text: "Custo abaixo da sua referência." }
        : diff >= 0.05
          ? { tone: "desfavoravel", text: "Custo acima da sua referência." }
          : { tone: "neutro", text: "Custo praticamente igual à sua referência." };
  }
  return {
    metrics: [
      { label: "Custo por milheiro", value: formatBRL(custo), emphasis: true },
      { label: "Custo por ponto", value: `R$ ${formatDecimal(custo / 1000)}` },
    ],
    verdict,
    explanation,
    raw: { custoMilheiro: custo },
  };
}

/* ------------------------------------------------------------------ */
/* B. Transferência bonificada                                         */
/* ------------------------------------------------------------------ */

export const transferenciaSchema = z.object({
  pontos: pos("os pontos a transferir"),
  paridadeOrigem: pos("a paridade (pontos de origem)", 1e4),
  paridadeDestino: pos("a paridade (milhas de destino)", 1e4),
  bonusPct: num("o bônus (%)", 0, 1000),
  custoMilheiroOrigem: opt(num("o custo do milheiro de origem (R$)", 0, 1e4)),
});

export function transferencia(i: z.infer<typeof transferenciaSchema>): CalcResult {
  const ratio = i.paridadeDestino / i.paridadeOrigem;
  const base = Math.floor(i.pontos * ratio);
  const recebidas = Math.floor(i.pontos * ratio * (1 + i.bonusPct / 100));
  const bonus = recebidas - base;
  const explanation = [
    `Paridade ${formatDecimal(i.paridadeOrigem)}:${formatDecimal(i.paridadeDestino)} → cada ponto vira ${formatDecimal(ratio)} milha(s).`,
    `Sem bônus: ${formatPoints(i.pontos)} × ${formatDecimal(ratio)} = ${formatPoints(base)} milhas.`,
    `Bônus de ${formatDecimal(i.bonusPct)}%: +${formatPoints(bonus)} milhas, total de ${formatPoints(recebidas)} (arredondado para baixo).`,
  ];
  const raw: Record<string, number> = { recebidas, bonus, ratio };
  const metrics: CalcResult["metrics"] = [
    { label: "Milhas recebidas", value: formatPoints(recebidas), emphasis: true },
    { label: "Milhas do bônus", value: `+${formatPoints(bonus)}` },
  ];
  if (i.custoMilheiroOrigem != null && recebidas > 0) {
    const custoTotal = (i.pontos / 1000) * i.custoMilheiroOrigem;
    const custoDestino = milheiroCost(custoTotal, recebidas);
    raw.custoMilheiroDestino = custoDestino;
    metrics.push({ label: "Custo do milheiro no destino", value: formatBRL(custoDestino) });
    explanation.push(
      `Custo dos pontos de origem: ${formatDecimal(i.pontos / 1000)} milheiros × ${formatBRL(i.custoMilheiroOrigem)} = ${formatBRL(custoTotal)}.`,
      `Custo efetivo no destino: ${formatBRL(custoTotal)} ÷ ${formatDecimal(recebidas / 1000)} = ${formatBRL(custoDestino)} por milheiro.`,
    );
  }
  explanation.push("Transferências costumam ser irreversíveis: confirme a disponibilidade da emissão antes de transferir.");
  return { metrics, explanation, raw };
}

/* ------------------------------------------------------------------ */
/* C. Compra de pontos                                                 */
/* ------------------------------------------------------------------ */

export const compraSchema = z.object({
  pontos: pos("a quantidade de pontos comprados"),
  precoMilheiro: pos("o preço cheio do milheiro (R$)", 1e4),
  descontoPct: num("o desconto (%)", 0, 100),
  bonusPct: num("o bônus (%)", 0, 1000),
  referencia: opt(pos("o valor de uso do milheiro (R$)", 1e4)),
});

export function compraPontos(i: z.infer<typeof compraSchema>): CalcResult {
  const preco = (i.pontos / 1000) * i.precoMilheiro * (1 - i.descontoPct / 100);
  const total = Math.floor(i.pontos * (1 + i.bonusPct / 100));
  const custo = milheiroCost(preco, total);
  const explanation = [
    `Preço: ${formatDecimal(i.pontos / 1000)} milheiros × ${formatBRL(i.precoMilheiro)} com ${formatDecimal(i.descontoPct)}% de desconto = ${formatBRL(preco)}.`,
    `Pontos recebidos com ${formatDecimal(i.bonusPct)}% de bônus: ${formatPoints(total)}.`,
    `Custo efetivo: ${formatBRL(preco)} ÷ ${formatDecimal(total / 1000)} = ${formatBRL(custo)} por milheiro.`,
  ];
  let verdict: CalcResult["verdict"];
  if (i.referencia) {
    const margem = i.referencia - custo;
    explanation.push(
      margem > 0
        ? `Se você usar esses pontos valendo ${formatBRL(i.referencia)} o milheiro, ganha ${formatBRL((margem * total) / 1000)} em relação ao que pagou.`
        : `Usando os pontos a ${formatBRL(i.referencia)} o milheiro, você perderia ${formatBRL((-margem * total) / 1000)}.`,
    );
    verdict =
      margem > 0
        ? { tone: "favoravel", text: "Compra vantajosa para o uso que você pretende." }
        : { tone: "desfavoravel", text: "Compra cara para o uso que você pretende." };
  }
  explanation.push("Compre pontos apenas com um resgate em vista: pontos parados perdem valor e podem vencer.");
  return {
    metrics: [
      { label: "Custo efetivo do milheiro", value: formatBRL(custo), emphasis: true },
      { label: "Valor a pagar", value: formatBRL(preco) },
      { label: "Pontos recebidos", value: formatPoints(total) },
    ],
    verdict,
    explanation,
    raw: { preco, total, custoMilheiro: custo },
  };
}

/* ------------------------------------------------------------------ */
/* D. Dinheiro x milhas                                                */
/* ------------------------------------------------------------------ */

export const dinheiroMilhasSchema = z.object({
  precoDinheiro: pos("o preço em dinheiro (R$)"),
  milhas: pos("as milhas necessárias"),
  taxas: num("as taxas da emissão (R$)", 0, 1e6),
  custoMilheiro: pos("o custo/valor do seu milheiro (R$)", 1e4),
});

export function dinheiroVsMilhas(i: z.infer<typeof dinheiroMilhasSchema>): CalcResult {
  const valorObtido = (i.precoDinheiro - i.taxas) / (i.milhas / 1000);
  const custoComMilhas = (i.milhas / 1000) * i.custoMilheiro + i.taxas;
  const economia = i.precoDinheiro - custoComMilhas;
  const explanation = [
    `Valor obtido por milheiro: (${formatBRL(i.precoDinheiro)} − ${formatBRL(i.taxas)} de taxas) ÷ ${formatDecimal(i.milhas / 1000)} = ${formatBRL(valorObtido)}.`,
    `Custo de emitir com milhas: ${formatDecimal(i.milhas / 1000)} × ${formatBRL(i.custoMilheiro)} + ${formatBRL(i.taxas)} = ${formatBRL(custoComMilhas)}.`,
    economia >= 0
      ? `Emitir com milhas economiza ${formatBRL(economia)} em relação a pagar em dinheiro.`
      : `Pagar em dinheiro sai ${formatBRL(-economia)} mais barato: guarde as milhas para um resgate melhor.`,
  ];
  const tone: Verdict = valorObtido > i.custoMilheiro * 1.05 ? "favoravel" : valorObtido < i.custoMilheiro * 0.95 ? "desfavoravel" : "neutro";
  return {
    metrics: [
      { label: "Valor obtido por milheiro", value: formatBRL(valorObtido), emphasis: true },
      { label: "Custo com milhas", value: formatBRL(custoComMilhas) },
      { label: economia >= 0 ? "Economia com milhas" : "Economia pagando em dinheiro", value: formatBRL(Math.abs(economia)) },
    ],
    verdict: {
      tone,
      text:
        tone === "favoravel"
          ? "Use milhas: o valor obtido supera o custo do seu milheiro."
          : tone === "desfavoravel"
            ? "Pague em dinheiro: o valor obtido fica abaixo do custo do seu milheiro."
            : "Empate técnico: decida pela flexibilidade (remarcação, cancelamento, acúmulo).",
    },
    explanation,
    raw: { valorObtido, custoComMilhas, economia },
  };
}

/* ------------------------------------------------------------------ */
/* E. Retorno anual de cartões                                         */
/* ------------------------------------------------------------------ */

export const retornoCartaoSchema = z
  .object({
    gastoMensal: pos("o gasto mensal (R$)"),
    pontosPorDolar: opt(num("os pontos por dólar", 0, 100)),
    pontosPorReal: opt(num("os pontos por real", 0, 100)),
    cotacaoDolar: pos("a cotação do dólar (R$)", 100),
    anuidade: num("a anuidade (R$)", 0, 1e6),
    valorMilheiro: pos("o valor do milheiro (R$)", 1e4),
    beneficiosAnuais: opt(num("o valor dos benefícios (R$)", 0, 1e6)),
  })
  .refine((v) => v.pontosPorDolar != null || v.pontosPorReal != null, {
    path: ["pontosPorDolar"],
    message: "Informe os pontos por dólar ou por real.",
  });

export function retornoCartao(i: z.infer<typeof retornoCartaoSchema>): CalcResult {
  const gastoAnual = i.gastoMensal * 12;
  const porReal = i.pontosPorReal ?? (i.pontosPorDolar ?? 0) / i.cotacaoDolar;
  const pontosAno = Math.floor(gastoAnual * porReal);
  const valorPontos = (pontosAno / 1000) * i.valorMilheiro;
  const beneficios = i.beneficiosAnuais ?? 0;
  const liquido = valorPontos + beneficios - i.anuidade;
  const retornoPct = liquido / gastoAnual;
  const breakEvenMensal = porReal > 0 ? Math.max(i.anuidade - beneficios, 0) / ((porReal * i.valorMilheiro) / 1000) / 12 : 0;
  const explanation = [
    i.pontosPorReal != null
      ? `Pontuação: ${formatDecimal(i.pontosPorReal)} ponto(s) por real.`
      : `Pontuação: ${formatDecimal(i.pontosPorDolar ?? 0)} ponto(s) por dólar ÷ ${formatBRL(i.cotacaoDolar)} = ${formatDecimal(porReal)} por real.`,
    `Pontos no ano: ${formatBRL(gastoAnual)} × ${formatDecimal(porReal)} = ${formatPoints(pontosAno)}.`,
    `Valor dos pontos: ${formatDecimal(pontosAno / 1000)} milheiros × ${formatBRL(i.valorMilheiro)} = ${formatBRL(valorPontos)}.`,
    `Retorno líquido: ${formatBRL(valorPontos)} + ${formatBRL(beneficios)} de benefícios − ${formatBRL(i.anuidade)} de anuidade = ${formatBRL(liquido)}.`,
  ];
  if (i.anuidade > beneficios && porReal > 0) {
    explanation.push(`A anuidade se paga a partir de ${formatBRL(breakEvenMensal)} de gasto mensal.`);
  }
  return {
    metrics: [
      { label: "Retorno líquido anual", value: formatBRL(liquido), emphasis: true },
      { label: "Retorno sobre o gasto", value: formatPct(retornoPct) },
      { label: "Pontos por ano", value: formatPoints(pontosAno) },
      { label: "Gasto mensal para empatar", value: i.anuidade > beneficios ? formatBRL(breakEvenMensal) : "—" },
    ],
    verdict: {
      tone: liquido > 0 ? "favoravel" : liquido < 0 ? "desfavoravel" : "neutro",
      text: liquido > 0 ? "O cartão gera retorno positivo com esse gasto." : "Com esse gasto, a anuidade supera o retorno.",
    },
    explanation,
    raw: { pontosAno, valorPontos, liquido, retornoPct, breakEvenMensal, porReal },
  };
}

/* ------------------------------------------------------------------ */
/* F. Clube de pontos                                                  */
/* ------------------------------------------------------------------ */

export const clubeSchema = z.object({
  mensalidade: pos("a mensalidade (R$)", 1e5),
  pontosMensais: num("os pontos mensais do clube", 0, 1e7),
  meses: pos("o período (meses)", 120).refine(Number.isInteger, "Use meses inteiros."),
  bonusExtraPct: num("o bônus extra em transferências (%)", 0, 1000),
  pontosTransferidos: num("os pontos transferidos no período", 0, 1e9),
  valorMilheiro: pos("o valor do milheiro (R$)", 1e4),
});

export function clubePontos(i: z.infer<typeof clubeSchema>): CalcResult {
  const custo = i.mensalidade * i.meses;
  const pontosClube = i.pontosMensais * i.meses;
  const pontosBonus = Math.floor(i.pontosTransferidos * (i.bonusExtraPct / 100));
  const totalPontos = pontosClube + pontosBonus;
  const valorGerado = (totalPontos / 1000) * i.valorMilheiro;
  const saldo = valorGerado - custo;
  const custoMilheiroClube = milheiroCost(custo, totalPontos);
  const explanation = [
    `Custo no período: ${formatBRL(i.mensalidade)} × ${i.meses} meses = ${formatBRL(custo)}.`,
    `Pontos do clube: ${formatPoints(i.pontosMensais)} × ${i.meses} = ${formatPoints(pontosClube)}.`,
    `Bônus extra de ${formatDecimal(i.bonusExtraPct)}% sobre ${formatPoints(i.pontosTransferidos)} transferidos = ${formatPoints(pontosBonus)}.`,
    `Valor gerado: ${formatDecimal(totalPontos / 1000)} milheiros × ${formatBRL(i.valorMilheiro)} = ${formatBRL(valorGerado)}.`,
    totalPontos > 0
      ? `Custo efetivo do milheiro via clube: ${formatBRL(custoMilheiroClube)} (compare com o preço de compra avulsa).`
      : "O clube não gera pontos com estas entradas.",
  ];
  return {
    metrics: [
      { label: "Saldo do clube no período", value: formatBRL(saldo), emphasis: true },
      { label: "Valor gerado", value: formatBRL(valorGerado) },
      { label: "Custo total", value: formatBRL(custo) },
      { label: "Custo do milheiro via clube", value: totalPontos > 0 ? formatBRL(custoMilheiroClube) : "—" },
    ],
    verdict: {
      tone: saldo > 0 ? "favoravel" : saldo < 0 ? "desfavoravel" : "neutro",
      text:
        saldo > 0
          ? "O clube se paga com esse uso."
          : "O clube custa mais do que gera: só compensa se você aumentar as transferências bonificadas.",
    },
    explanation,
    raw: { custo, pontosClube, pontosBonus, totalPontos, valorGerado, saldo, custoMilheiroClube },
  };
}

/* ------------------------------------------------------------------ */
/* Registro                                                            */
/* ------------------------------------------------------------------ */

export const CALCULATORS = {
  custo_milheiro: { schema: custoMilheiroSchema, run: custoMilheiro },
  transferencia_bonificada: { schema: transferenciaSchema, run: transferencia },
  compra_pontos: { schema: compraSchema, run: compraPontos },
  dinheiro_vs_milhas: { schema: dinheiroMilhasSchema, run: dinheiroVsMilhas },
  retorno_cartao: { schema: retornoCartaoSchema, run: retornoCartao },
  clube_pontos: { schema: clubeSchema, run: clubePontos },
} as const;

export type CalculatorKey = keyof typeof CALCULATORS;

/** Valida e executa uma calculadora a partir de entradas cruas (ex.: FormData). */
export function runCalculator(key: CalculatorKey, input: Record<string, unknown>) {
  const calc = CALCULATORS[key] as unknown as { schema: z.ZodType; run: (i: unknown) => CalcResult };
  const parsed = calc.schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined> };
  }
  return { ok: true as const, input: parsed.data as Record<string, unknown>, result: calc.run(parsed.data) };
}
