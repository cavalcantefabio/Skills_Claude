"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/forms/submit";
import { useActionForm } from "@/components/forms/use-action-form";
import type { ActionState } from "@/server/services/errors";

export function QuoteForm({
  action,
  programs,
  today,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  programs: { id: string; name: string }[];
  today: string;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const [kind, setKind] = useState("milhas");
  const [certainty, setCertainty] = useState("real");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.querySelectorAll<HTMLInputElement>("input:not([type=date])").forEach((i) => (i.value = ""));
  }, [state]);
  const fe = state?.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader
          title="Adicionar cotação"
          description="Consulte no site do programa ou da companhia e registre os valores por passageiro. Nada aqui é buscado automaticamente."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="q-kind">
            <Select id="q-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="milhas">Em milhas</option>
              <option value="dinheiro">Em dinheiro</option>
            </Select>
          </Field>
          <Field label="Origem do valor" htmlFor="q-cert" hint={certainty === "real" ? "Você consultou e viu o valor." : "Referência pesquisada: exige link da fonte."}>
            <Select id="q-cert" name="certainty" value={certainty} onChange={(e) => setCertainty(e.target.value)}>
              <option value="real">Real (consultei)</option>
              <option value="estimativa">Estimativa (referência)</option>
            </Select>
          </Field>
          {kind === "milhas" ? (
            <>
              <Field label="Programa" htmlFor="q-prog" error={fe.programId}>
                <Select id="q-prog" name="programId" defaultValue="">
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Milhas por passageiro" htmlFor="q-miles" error={fe.milesPerPax}>
                <Input id="q-miles" name="milesPerPax" inputMode="numeric" aria-invalid={!!fe.milesPerPax} />
              </Field>
              <Field label="Taxas por passageiro (R$)" htmlFor="q-tax" error={fe.taxesPerPaxBrl} hint="Taxas de embarque e de emissão.">
                <Input id="q-tax" name="taxesPerPaxBrl" inputMode="decimal" aria-invalid={!!fe.taxesPerPaxBrl} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Companhia ou site" htmlFor="q-label" error={fe.label}>
                <Input id="q-label" name="label" placeholder="Ex.: site da companhia" />
              </Field>
              <Field label="Preço por passageiro (R$, com taxas)" htmlFor="q-cash" error={fe.cashPerPaxBrl}>
                <Input id="q-cash" name="cashPerPaxBrl" inputMode="decimal" aria-invalid={!!fe.cashPerPaxBrl} />
              </Field>
            </>
          )}
          <Field label="O valor cobre" htmlFor="q-covers">
            <Select id="q-covers" name="covers" defaultValue="ida_volta">
              <option value="ida_volta">Ida e volta</option>
              <option value="ida">Só um trecho</option>
            </Select>
          </Field>
          <Field label="Consultado em" htmlFor="q-date" error={fe.checkedOn}>
            <Input id="q-date" name="checkedOn" type="date" defaultValue={today} max={today} />
          </Field>
          <Field label={certainty === "estimativa" ? "Link da fonte" : "Link da fonte (opcional)"} htmlFor="q-src" error={fe.sourceUrl} className="sm:col-span-2">
            <Input id="q-src" name="sourceUrl" type="url" placeholder="https://" aria-invalid={!!fe.sourceUrl} />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div>
              <SubmitButton pending={pending}>Adicionar cotação</SubmitButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
