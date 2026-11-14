"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "./submit";
import { useActionForm } from "./use-action-form";
import { CABIN_LABEL, TRIP_STATUS_LABEL } from "@/lib/labels";
import type { ActionState } from "@/server/services/errors";

type Values = Partial<{
  title: string;
  origin: string;
  destination: string;
  departDate: string | null;
  returnDate: string | null;
  tripType: string;
  flexDays: number;
  passengers: number;
  cabin: string;
  status: string;
  budgetBrl: string | number | null;
  alertDaysBefore: number;
  watchPromotions: boolean;
  notes: string | null;
}>;

export function TripForm({
  action,
  accounts,
  consideredAccountIds = [],
  initial = {},
  cancelHref = "/viagens",
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  accounts: { id: string; programName: string; kind: string; balance: number; unit: string }[];
  consideredAccountIds?: string[];
  initial?: Values;
  cancelHref?: string;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const [tripType, setTripType] = useState(initial.tripType ?? "ida_volta");
  const fe = state?.fieldErrors ?? {};
  const v = (x: unknown) => (x == null ? "" : String(x));
  const allSelected = consideredAccountIds.length === 0;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Viagem" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Nome da viagem" htmlFor="title" error={fe.title} className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={v(initial.title)} placeholder="Ex.: Orlando com a família" aria-invalid={!!fe.title} />
          </Field>
          <Field label="Aeroporto de origem" htmlFor="origin" error={fe.origin} hint="Código IATA (GRU) ou cidade.">
            <Input id="origin" name="origin" defaultValue={v(initial.origin)} aria-invalid={!!fe.origin} />
          </Field>
          <Field label="Destino" htmlFor="destination" error={fe.destination} hint="Ex.: MCO (Orlando).">
            <Input id="destination" name="destination" defaultValue={v(initial.destination)} aria-invalid={!!fe.destination} />
          </Field>
          <Field label="Tipo" htmlFor="tripType">
            <Select id="tripType" name="tripType" value={tripType} onChange={(e) => setTripType(e.target.value)}>
              <option value="ida_volta">Ida e volta</option>
              <option value="ida">Só ida</option>
            </Select>
          </Field>
          <Field label="Flexibilidade das datas" htmlFor="flexDays" error={fe.flexDays}>
            <Select id="flexDays" name="flexDays" defaultValue={v(initial.flexDays ?? 0)}>
              <option value="0">Datas fixas</option>
              {[1, 2, 3, 5, 7, 15, 30].map((d) => (
                <option key={d} value={d}>
                  ± {d} dia{d > 1 ? "s" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ida" htmlFor="departDate" error={fe.departDate}>
            <Input id="departDate" name="departDate" type="date" defaultValue={v(initial.departDate)} aria-invalid={!!fe.departDate} />
          </Field>
          {tripType === "ida_volta" && (
            <Field label="Volta" htmlFor="returnDate" error={fe.returnDate}>
              <Input id="returnDate" name="returnDate" type="date" defaultValue={v(initial.returnDate)} aria-invalid={!!fe.returnDate} />
            </Field>
          )}
          <Field label="Passageiros" htmlFor="passengers" error={fe.passengers}>
            <Input id="passengers" name="passengers" inputMode="numeric" defaultValue={v(initial.passengers ?? 1)} aria-invalid={!!fe.passengers} />
          </Field>
          <Field label="Classe" htmlFor="cabin">
            <Select id="cabin" name="cabin" defaultValue={v(initial.cabin) || "economica"}>
              {Object.entries(CABIN_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Orçamento estimado (R$, total)" htmlFor="budgetBrl" error={fe.budgetBrl} hint="Quanto você quer gastar em dinheiro, incluindo taxas.">
            <Input id="budgetBrl" name="budgetBrl" inputMode="decimal" defaultValue={v(initial.budgetBrl)} aria-invalid={!!fe.budgetBrl} />
          </Field>
          <Field label="Situação" htmlFor="status">
            <Select id="status" name="status" defaultValue={v(initial.status) || "planejada"}>
              {Object.entries(TRIP_STATUS_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Observações" htmlFor="notes" error={fe.notes} className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={v(initial.notes)} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Programas disponíveis" description="Quais programas entram no plano. Pontos de banco contam como possíveis transferências." />
        <CardBody>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted">Cadastre seus programas em Programas de Fidelidade.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="accountIds"
                    value={a.id}
                    defaultChecked={allSelected || consideredAccountIds.includes(a.id)}
                    className="size-4 accent-[var(--accent)]"
                  />
                  <span className="flex-1">{a.programName}</span>
                  <span className="tabular text-xs text-muted">
                    {a.balance.toLocaleString("pt-BR")} {a.unit}
                  </span>
                </label>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Alertas desta viagem" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Avisar se a meta não estiver garantida a (dias do embarque)"
            htmlFor="alertDaysBefore"
            error={fe.alertDaysBefore}
          >
            <Input id="alertDaysBefore" name="alertDaysBefore" inputMode="numeric" defaultValue={v(initial.alertDaysBefore ?? 60)} />
          </Field>
          <label className="flex items-center gap-2.5 self-end pb-2 text-sm text-ink-2">
            <input type="checkbox" name="watchPromotions" defaultChecked={initial.watchPromotions ?? true} className="size-4 accent-[var(--accent)]" />
            Avisar promoções do Radar para os programas desta viagem
          </label>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div className="flex gap-2">
              <SubmitButton pending={pending}>Salvar viagem</SubmitButton>
              <LinkButton href={cancelHref} variant="secondary">
                Cancelar
              </LinkButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
