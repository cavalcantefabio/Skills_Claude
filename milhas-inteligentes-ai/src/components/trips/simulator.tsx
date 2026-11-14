"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Field, Input, Select } from "@/components/ui";
import { simulateExtra } from "@/lib/travel-plan";
import { addDaysISO } from "@/lib/dates";
import { formatDate, formatPoints } from "@/lib/format";
import { parseNumber } from "@/lib/validation";

/** Simulador de acúmulo: quanto antes chego à meta com gasto extra no cartão ou compra mensal. */
export function StrategySimulator({
  remaining,
  monthlyRate,
  unit,
  departDate,
  today,
  cards,
}: {
  remaining: number;
  monthlyRate: number;
  unit: string;
  departDate: string | null;
  today: string;
  cards: { id: string; label: string; pointsPerBrl: number }[];
}) {
  const [spend, setSpend] = useState("1000");
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [buy, setBuy] = useState("0");
  const num = (s: string) => {
    const v = parseNumber(s);
    return typeof v === "number" && v >= 0 ? v : 0;
  };
  const card = cards.find((c) => c.id === cardId);
  const r = useMemo(
    () => simulateExtra({ remaining, monthlyRate, extraSpendBrl: num(spend), pointsPerBrl: card?.pointsPerBrl ?? 0, monthlyPurchase: num(buy) }),
    [remaining, monthlyRate, spend, card, buy],
  );
  const reach = r.months == null ? null : addDaysISO(today, Math.round(r.months * 30.44));
  const onTime = reach && departDate ? reach <= departDate : null;
  return (
    <Card>
      <CardHeader
        title="Simular estratégia de acúmulo"
        description={`Faltam ${formatPoints(remaining)} ${unit}. Hoje você acumula cerca de ${formatPoints(Math.round(monthlyRate))} por mês.`}
      />
      <CardBody className="grid gap-4 sm:grid-cols-3">
        <Field label="Gasto extra no cartão por mês (R$)" htmlFor="sim-spend">
          <Input id="sim-spend" inputMode="decimal" value={spend} onChange={(e) => setSpend(e.target.value)} />
        </Field>
        <Field label="Cartão" htmlFor="sim-card" hint={card ? `${card.pointsPerBrl.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ponto(s) por real` : "Cadastre cartões para simular"}>
          <Select id="sim-card" value={cardId} onChange={(e) => setCardId(e.target.value)} disabled={!cards.length}>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Compra mensal de ${unit}`} htmlFor="sim-buy" hint="Só se a compra compensar (veja a análise).">
          <Input id="sim-buy" inputMode="numeric" value={buy} onChange={(e) => setBuy(e.target.value)} />
        </Field>
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm sm:col-span-3" aria-live="polite">
          {r.months == null ? (
            <p>Sem acúmulo mensal, a meta não é atingida.</p>
          ) : r.months === 0 ? (
            <p>Seu saldo já cobre a meta.</p>
          ) : (
            <p>
              Com cerca de <span className="font-semibold">{formatPoints(Math.round(r.monthly))}</span> por mês, a meta chega em{" "}
              <span className="font-semibold">{r.months} mês(es)</span> (por volta de {formatDate(reach)})
              {onTime == null ? "." : onTime ? ", antes do embarque." : ", depois do embarque."}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">Estimativa: considera transferências de banco na paridade 1:1, sem bônus.</p>
        </div>
      </CardBody>
    </Card>
  );
}
