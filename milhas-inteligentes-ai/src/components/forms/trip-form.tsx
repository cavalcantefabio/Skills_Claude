"use client";

import { Card, CardBody, Field, FormMessage, Input, LinkButton, Select, Textarea } from "@/components/ui";
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
  passengers: number;
  cabin: string;
  status: string;
  programId: string | null;
  milesNeeded: number | null;
  cashPriceBrl: string | number | null;
  flexibleDates: boolean;
  notes: string | null;
}>;

export function TripForm({
  action,
  programs,
  initial = {},
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  programs: { id: string; name: string }[];
  initial?: Values;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const fe = state?.fieldErrors ?? {};
  const v = (x: unknown) => (x == null ? "" : String(x));
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardBody className="grid gap-5 pt-6 sm:grid-cols-2">
          <Field label="Nome da viagem" htmlFor="title" error={fe.title} className="sm:col-span-2">
            <Input id="title" name="title" defaultValue={v(initial.title)} placeholder="Ex.: Férias em Lisboa" aria-invalid={!!fe.title} />
          </Field>
          <Field label="Origem" htmlFor="origin" error={fe.origin} hint="Código IATA (GRU) ou cidade.">
            <Input id="origin" name="origin" defaultValue={v(initial.origin)} aria-invalid={!!fe.origin} />
          </Field>
          <Field label="Destino" htmlFor="destination" error={fe.destination}>
            <Input id="destination" name="destination" defaultValue={v(initial.destination)} aria-invalid={!!fe.destination} />
          </Field>
          <Field label="Ida" htmlFor="departDate" error={fe.departDate}>
            <Input id="departDate" name="departDate" type="date" defaultValue={v(initial.departDate)} />
          </Field>
          <Field label="Volta" htmlFor="returnDate" error={fe.returnDate} hint="Deixe em branco para só ida.">
            <Input id="returnDate" name="returnDate" type="date" defaultValue={v(initial.returnDate)} aria-invalid={!!fe.returnDate} />
          </Field>
          <Field label="Passageiros" htmlFor="passengers" error={fe.passengers}>
            <Input id="passengers" name="passengers" inputMode="numeric" defaultValue={v(initial.passengers ?? 1)} aria-invalid={!!fe.passengers} />
          </Field>
          <Field label="Cabine" htmlFor="cabin">
            <Select id="cabin" name="cabin" defaultValue={v(initial.cabin) || "economica"}>
              {Object.entries(CABIN_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Programa para emitir" htmlFor="programId" error={fe.programId}>
            <Select id="programId" name="programId" defaultValue={v(initial.programId)}>
              <option value="">Ainda não sei</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
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
          <Field label="Milhas necessárias (total)" htmlFor="milesNeeded" error={fe.milesNeeded} hint="Cotação que você encontrou no programa.">
            <Input id="milesNeeded" name="milesNeeded" inputMode="numeric" defaultValue={v(initial.milesNeeded)} aria-invalid={!!fe.milesNeeded} />
          </Field>
          <Field label="Preço em dinheiro (R$, total)" htmlFor="cashPriceBrl" error={fe.cashPriceBrl}>
            <Input id="cashPriceBrl" name="cashPriceBrl" inputMode="decimal" defaultValue={v(initial.cashPriceBrl)} aria-invalid={!!fe.cashPriceBrl} />
          </Field>
          <label className="flex items-center gap-2.5 text-sm text-ink-2 sm:col-span-2">
            <input type="checkbox" name="flexibleDates" defaultChecked={initial.flexibleDates} className="size-4 accent-[var(--accent)]" />
            Datas flexíveis
          </label>
          <Field label="Observações" htmlFor="notes" error={fe.notes} className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={v(initial.notes)} />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div className="flex gap-2">
              <SubmitButton pending={pending}>Salvar viagem</SubmitButton>
              <LinkButton href="/viagens" variant="secondary">
                Cancelar
              </LinkButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
