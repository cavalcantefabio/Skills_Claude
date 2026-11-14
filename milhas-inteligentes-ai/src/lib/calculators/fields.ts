import type { CalculatorKey } from "./index";

export type CalcField = { name: string; label: string; hint?: string; placeholder?: string; optional?: boolean; def?: string };

export const CALC_META: Record<
  CalculatorKey,
  { title: string; short: string; description: string; fields: CalcField[] }
> = {
  custo_milheiro: {
    title: "Custo por milheiro",
    short: "Milheiro",
    description: "Quanto você pagou por cada 1.000 pontos em uma compra, assinatura ou acúmulo.",
    fields: [
      { name: "valorPago", label: "Valor pago (R$)", def: "1750" },
      { name: "pontos", label: "Pontos recebidos", def: "100000" },
      { name: "referencia", label: "Seu milheiro de referência (R$)", optional: true, hint: "Opcional: compara o custo com o valor que você atribui." },
    ],
  },
  transferencia_bonificada: {
    title: "Transferência bonificada",
    short: "Transferência",
    description: "Quantas milhas chegam no destino e quanto custa cada milheiro depois do bônus.",
    fields: [
      { name: "pontos", label: "Pontos a transferir", def: "50000" },
      { name: "paridadeOrigem", label: "Paridade: pontos de origem", def: "1", hint: "Em 2:1, use 2 aqui e 1 ao lado." },
      { name: "paridadeDestino", label: "Paridade: milhas de destino", def: "1" },
      { name: "bonusPct", label: "Bônus da promoção (%)", def: "80" },
      { name: "custoMilheiroOrigem", label: "Custo do milheiro de origem (R$)", optional: true, def: "35", hint: "Opcional: quanto custou cada 1.000 pontos de origem." },
    ],
  },
  compra_pontos: {
    title: "Compra de pontos",
    short: "Compra",
    description: "Custo efetivo de uma compra de pontos com desconto e bônus.",
    fields: [
      { name: "pontos", label: "Pontos comprados", def: "20000" },
      { name: "precoMilheiro", label: "Preço cheio do milheiro (R$)", def: "70" },
      { name: "descontoPct", label: "Desconto (%)", def: "50" },
      { name: "bonusPct", label: "Bônus (%)", def: "0" },
      { name: "referencia", label: "Valor de uso do milheiro (R$)", optional: true, hint: "Opcional: quanto vale o milheiro no resgate que você pretende." },
    ],
  },
  dinheiro_vs_milhas: {
    title: "Dinheiro x milhas",
    short: "Dinheiro x milhas",
    description: "Se vale mais pagar a passagem em dinheiro ou emitir com milhas.",
    fields: [
      { name: "precoDinheiro", label: "Preço em dinheiro (R$)", def: "1800" },
      { name: "milhas", label: "Milhas necessárias", def: "60000" },
      { name: "taxas", label: "Taxas da emissão (R$)", def: "90" },
      { name: "custoMilheiro", label: "Custo ou valor do seu milheiro (R$)", def: "20", hint: "Quanto custa repor 1.000 milhas desse programa." },
    ],
  },
  retorno_cartao: {
    title: "Retorno anual do cartão",
    short: "Cartão",
    description: "Retorno líquido de um cartão: pontos gerados menos anuidade.",
    fields: [
      { name: "gastoMensal", label: "Gasto mensal (R$)", def: "6000" },
      { name: "pontosPorDolar", label: "Pontos por dólar", optional: true, def: "2.2" },
      { name: "pontosPorReal", label: "Pontos por real", optional: true, hint: "Preencha este ou o de dólar." },
      { name: "cotacaoDolar", label: "Cotação do dólar (R$)", def: "5.5" },
      { name: "anuidade", label: "Anuidade anual (R$)", def: "1200" },
      { name: "valorMilheiro", label: "Valor do milheiro (R$)", def: "25" },
      { name: "beneficiosAnuais", label: "Benefícios em R$ por ano", optional: true, hint: "Opcional: salas VIP, seguros etc. que você usaria de fato." },
    ],
  },
  clube_pontos: {
    title: "Clube de pontos",
    short: "Clube",
    description: "Se a assinatura de um clube se paga com os pontos e bônus que ela gera.",
    fields: [
      { name: "mensalidade", label: "Mensalidade (R$)", def: "84" },
      { name: "pontosMensais", label: "Pontos mensais do clube", def: "2000" },
      { name: "meses", label: "Período (meses)", def: "12" },
      { name: "bonusExtraPct", label: "Bônus extra para assinantes (%)", def: "20", hint: "Bônus adicional em transferências por ser assinante." },
      { name: "pontosTransferidos", label: "Pontos transferidos no período", def: "60000" },
      { name: "valorMilheiro", label: "Valor do milheiro (R$)", def: "16" },
    ],
  },
};
