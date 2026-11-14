"use client";

import { useState } from "react";
import { useActionForm } from "./use-action-form";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "./submit";
import { KIND_LABEL } from "@/lib/labels";
import type { ActionState } from "@/server/services/errors";

type Program = { id: string; name: string; kind: string };
type ClubValues = Partial<{
  clubName: string | null;
  clubMonthlyCostBrl: number | null;
  clubMonthlyPoints: number | null;
  milheiroValueBrl: number | null;
  notes: string | null;
}>;
type FE = Record<string, string[] | undefined>;

const v = (x: unknown) => (x == null ? "" : String(x));

function ClubFields({ fe, initial = {} }: { fe: FE; initial?: ClubValues }) {
  return (
    <>
      <Field
        label="Valor do milheiro (R$)"
        htmlFor="milheiroValueBrl"
        error={fe.milheiroValueBrl}
        hint="Quanto valem 1.000 pontos para você. Base do valor estimado no dashboard."
        className="sm:col-span-2"
      >
        <Input id="milheiroValueBrl" name="milheiroValueBrl" inputMode="decimal" defaultValue={v(initial.milheiroValueBrl)} className="sm:w-48" aria-invalid={!!fe.milheiroValueBrl} />
      </Field>
      <Field label="Clube contratado" htmlFor="clubName" error={fe.clubName} hint="Deixe em branco se não assina.">
        <Input id="clubName" name="clubName" defaultValue={v(initial.clubName)} placeholder="Ex.: Clube Smiles 2.000" />
      </Field>
      <Field label="Custo mensal da assinatura (R$)" htmlFor="clubMonthlyCostBrl" error={fe.clubMonthlyCostBrl}>
        <Input id="clubMonthlyCostBrl" name="clubMonthlyCostBrl" inputMode="decimal" defaultValue={v(initial.clubMonthlyCostBrl)} aria-invalid={!!fe.clubMonthlyCostBrl} />
      </Field>
      <Field label="Pontos mensais do clube" htmlFor="clubMonthlyPoints" error={fe.clubMonthlyPoints}>
        <Input id="clubMonthlyPoints" name="clubMonthlyPoints" inputMode="numeric" defaultValue={v(initial.clubMonthlyPoints)} aria-invalid={!!fe.clubMonthlyPoints} />
      </Field>
      <Field label="Observações" htmlFor="notes" error={fe.notes} className="sm:col-span-2">
        <Textarea id="notes" name="notes" defaultValue={v(initial.notes)} />
      </Field>
    </>
  );
}

export function NewAccountForm({
  action,
  programs,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  programs: Program[];
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const fe = state?.fieldErrors ?? {};
  const custom = programId === "";
  const groups = Object.entries(KIND_LABEL)
    .map(([k, label]) => ({ label, items: programs.filter((p) => p.kind === k) }))
    .filter((g) => g.items.length);

  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader title="Programa e saldo" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <Field label="Programa" htmlFor="programId" error={fe.programId} className="sm:col-span-2">
            <Select id="programId" name="programId" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              ))}
              <option value="">Outro programa (personalizado)…</option>
            </Select>
          </Field>
          {custom && (
            <>
              <Field label="Nome do programa" htmlFor="customName" error={fe.customName}>
                <Input id="customName" name="customName" placeholder="Ex.: KM de Vantagens" />
              </Field>
              <Field label="Tipo" htmlFor="customKind">
                <Select id="customKind" name="customKind" defaultValue="outro">
                  {Object.entries(KIND_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Unidade" htmlFor="customUnit" hint="pontos, milhas, km...">
                <Input id="customUnit" name="customUnit" defaultValue="pontos" />
              </Field>
            </>
          )}
          <Field label="Saldo atual" htmlFor="initialBalance" error={fe.initialBalance} hint="Pode ficar em branco e ser lançado depois.">
            <Input id="initialBalance" name="initialBalance" inputMode="numeric" aria-invalid={!!fe.initialBalance} />
          </Field>
          <Field label="Validade desse saldo" htmlFor="expiresAt" error={fe.expiresAt} hint="Se houver várias validades, lance os lotes em Minhas Milhas.">
            <Input id="expiresAt" name="expiresAt" type="date" aria-invalid={!!fe.expiresAt} />
          </Field>
        </CardBody>
        <CardHeader title="Valor e clube" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <ClubFields fe={fe} />
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div className="flex gap-2">
              <SubmitButton pending={pending}>Cadastrar programa</SubmitButton>
              <LinkButton href="/programas" variant="secondary">
                Cancelar
              </LinkButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

export function EditAccountForm({
  action,
  initial,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial: ClubValues;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader title="Valor e clube" />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <ClubFields fe={fe} initial={initial} />
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div>
              <SubmitButton pending={pending}>Salvar alterações</SubmitButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
