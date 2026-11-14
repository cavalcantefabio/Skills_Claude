"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Field, Input, Table, td, th, cx } from "@/components/ui";
import { retornoCartao } from "@/lib/calculators";
import { formatBRL, formatPct, formatPoints } from "@/lib/format";
import { parseNumber } from "@/lib/validation";

type C = {
  id: string;
  label: string;
  programName: string | null;
  annualFeeBrl: number;
  pointsPerUsd: number | null;
  pointsPerBrl: number | null;
  /** Valor do milheiro definido pelo usuário no programa do cartão. */
  milheiro: number | null;
};

const toNum = (s: string) => {
  const v = parseNumber(s);
  return typeof v === "number" && v >= 0 ? v : null;
};

/** Compara os cartões cadastrados para um mesmo gasto mensal, usando a calculadora de retorno anual. */
export function CardCompare({ cards, usdRate }: { cards: C[]; usdRate: number }) {
  const [spend, setSpend] = useState("5000");
  const [fallback, setFallback] = useState("20");
  const spendN = toNum(spend);
  const fallbackN = toNum(fallback);

  const rows = useMemo(() => {
    if (!spendN || !fallbackN) return [];
    return cards
      .map((c) => {
        const milheiro = c.milheiro ?? fallbackN;
        const r = retornoCartao({
          gastoMensal: spendN,
          pontosPorDolar: c.pointsPerUsd ?? undefined,
          pontosPorReal: c.pointsPerBrl ?? undefined,
          cotacaoDolar: usdRate,
          anuidade: c.annualFeeBrl,
          valorMilheiro: milheiro,
        });
        return { c, milheiro, usedFallback: c.milheiro == null, r: r.raw };
      })
      .sort((a, b) => b.r.liquido - a.r.liquido);
  }, [cards, spendN, fallbackN, usdRate]);

  return (
    <Card>
      <CardHeader
        title="Comparar cartões"
        description={`Retorno anual estimado para o mesmo gasto. Dólar de referência: ${formatBRL(usdRate)} (ajuste em Configurações). Benefícios não monetizados ficam de fora.`}
      />
      <CardBody>
        <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:max-w-xl">
          <Field label="Gasto mensal no cartão (R$)" htmlFor="cmp-spend" error={spendN ? undefined : "Informe um valor maior que zero."}>
            <Input id="cmp-spend" inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </Field>
          <Field
            label="Milheiro padrão (R$)"
            htmlFor="cmp-mil"
            hint="Usado quando o programa do cartão não tem valor definido."
            error={fallbackN ? undefined : "Informe um valor maior que zero."}
          >
            <Input id="cmp-mil" inputMode="decimal" value={fallback} onChange={(e) => setFallback(e.target.value)} />
          </Field>
        </div>
        {rows.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th className={th}>Cartão</th>
                <th className={`${th} text-right`}>Pontos/ano</th>
                <th className={`${th} text-right`}>Milheiro usado</th>
                <th className={`${th} text-right`}>Valor dos pontos</th>
                <th className={`${th} text-right`}>Anuidade</th>
                <th className={`${th} text-right`}>Retorno líquido</th>
                <th className={`${th} text-right`}>% do gasto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, milheiro, usedFallback, r }, i) => (
                <tr key={c.id} className={i === 0 ? "bg-accent-soft/40" : undefined}>
                  <td className={td}>
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-muted">{c.programName ?? "Sem programa"}</p>
                  </td>
                  <td className={`${td} tabular text-right`}>{formatPoints(r.pontosAno)}</td>
                  <td className={`${td} tabular text-right`}>
                    {formatBRL(milheiro)}
                    {usedFallback && <span className="block text-[11px] text-muted">padrão</span>}
                  </td>
                  <td className={`${td} tabular text-right`}>{formatBRL(r.valorPontos)}</td>
                  <td className={`${td} tabular text-right`}>{formatBRL(c.annualFeeBrl)}</td>
                  <td className={cx(td, "tabular text-right font-semibold", r.liquido >= 0 ? "text-good-ink" : "text-critical-ink")}>
                    {formatBRL(r.liquido)}
                  </td>
                  <td className={`${td} tabular text-right`}>{formatPct(r.retornoPct)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
