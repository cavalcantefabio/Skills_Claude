"use client";

import { useActionForm } from "./use-action-form";
import { Card, CardBody, Field, FormMessage, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "./submit";
import { BRAND_LABEL } from "@/lib/labels";
import type { ActionState } from "@/server/services/errors";

type Program = { id: string; name: string; kind: string };
type Values = Partial<{
  issuer: string;
  name: string;
  brand: string;
  annualFeeBrl: number;
  pointsPerUsd: number | null;
  pointsPerBrl: number | null;
  programId: string | null;
  benefits: string | null;
  creditLimit: number | null;
  dueDay: number | null;
  notes: string | null;
}>;

export function CardForm({
  action,
  programs,
  initial = {},
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  programs: Program[];
  initial?: Values;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const fe = state?.fieldErrors ?? {};
  const v = (x: unknown) => (x == null ? "" : String(x));
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardBody className="grid gap-5 pt-6 sm:grid-cols-2">
          <Field label="Banco emissor" htmlFor="issuer" error={fe.issuer}>
            <Input id="issuer" name="issuer" defaultValue={v(initial.issuer)} placeholder="Ex.: Itaú" aria-invalid={!!fe.issuer} />
          </Field>
          <Field label="Nome do cartão" htmlFor="name" error={fe.name}>
            <Input id="name" name="name" defaultValue={v(initial.name)} placeholder="Ex.: Personnalité Black" aria-invalid={!!fe.name} />
          </Field>
          <Field label="Bandeira" htmlFor="brand" error={fe.brand}>
            <Select id="brand" name="brand" defaultValue={v(initial.brand) || "visa"}>
              {Object.entries(BRAND_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Programa de fidelidade" htmlFor="programId" error={fe.programId} hint="Para onde os pontos do cartão vão.">
            <Select id="programId" name="programId" defaultValue={v(initial.programId)}>
              <option value="">Nenhum / cashback</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Anuidade anual (R$)" htmlFor="annualFeeBrl" error={fe.annualFeeBrl}>
            <Input id="annualFeeBrl" name="annualFeeBrl" inputMode="decimal" defaultValue={v(initial.annualFeeBrl ?? 0)} aria-invalid={!!fe.annualFeeBrl} />
          </Field>
          <Field label="Dia de vencimento da fatura" htmlFor="dueDay" error={fe.dueDay}>
            <Input id="dueDay" name="dueDay" inputMode="numeric" defaultValue={v(initial.dueDay)} placeholder="1 a 31" aria-invalid={!!fe.dueDay} />
          </Field>
          <Field label="Pontos por dólar" htmlFor="pointsPerUsd" error={fe.pointsPerUsd} hint="Ex.: 2,2 pts/US$">
            <Input id="pointsPerUsd" name="pointsPerUsd" inputMode="decimal" defaultValue={v(initial.pointsPerUsd)} aria-invalid={!!fe.pointsPerUsd} />
          </Field>
          <Field label="Pontos por real" htmlFor="pointsPerBrl" error={fe.pointsPerBrl} hint="Preencha se o cartão pontua em reais.">
            <Input id="pointsPerBrl" name="pointsPerBrl" inputMode="decimal" defaultValue={v(initial.pointsPerBrl)} aria-invalid={!!fe.pointsPerBrl} />
          </Field>
          <Field label="Limite de crédito (opcional)" htmlFor="creditLimit" error={fe.creditLimit} hint="Guardado de forma criptografada.">
            <Input id="creditLimit" name="creditLimit" inputMode="decimal" defaultValue={v(initial.creditLimit)} aria-invalid={!!fe.creditLimit} />
          </Field>
          <Field label="Benefícios" htmlFor="benefits" error={fe.benefits} className="sm:col-span-2">
            <Textarea id="benefits" name="benefits" defaultValue={v(initial.benefits)} placeholder="Salas VIP, seguro viagem, isenção de anuidade..." />
          </Field>
          <Field label="Observações" htmlFor="notes" error={fe.notes} className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={v(initial.notes)} />
          </Field>
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-2 sm:col-span-2">
            Nunca informe número do cartão, CVV ou senhas: o sistema não pede nem armazena esses dados.
          </p>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div className="flex gap-2">
              <SubmitButton pending={pending}>Salvar cartão</SubmitButton>
              <LinkButton href="/cartoes" variant="secondary">
                Cancelar
              </LinkButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
