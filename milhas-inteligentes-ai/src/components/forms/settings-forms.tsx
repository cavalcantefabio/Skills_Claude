"use client";

import { Card, CardBody, CardHeader, Field, FormMessage, Input } from "@/components/ui";
import { SubmitButton } from "./submit";
import { useActionForm } from "./use-action-form";
import type { ActionState } from "@/server/services/errors";

type Action = (s: ActionState, f: FormData) => Promise<ActionState>;

export function ProfileForm({
  action,
  initial,
}: {
  action: Action;
  initial: { name: string; usdRateBrl: number; expiryAlertDays: number; email: string };
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader title="Perfil e preferências" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="name" error={fe.name}>
            <Input id="name" name="name" defaultValue={initial.name} aria-invalid={!!fe.name} />
          </Field>
          <Field label="E-mail" htmlFor="email" hint="Usado para entrar. Alteração em uma próxima versão.">
            <Input id="email" value={initial.email} disabled readOnly />
          </Field>
          <Field label="Cotação de referência do dólar (R$)" htmlFor="usdRateBrl" error={fe.usdRateBrl} hint="Usada para converter pontos por dólar.">
            <Input id="usdRateBrl" name="usdRateBrl" inputMode="decimal" defaultValue={String(initial.usdRateBrl)} aria-invalid={!!fe.usdRateBrl} />
          </Field>
          <Field label="Avisar vencimentos com antecedência de (dias)" htmlFor="expiryAlertDays" error={fe.expiryAlertDays}>
            <Input id="expiryAlertDays" name="expiryAlertDays" inputMode="numeric" defaultValue={String(initial.expiryAlertDays)} aria-invalid={!!fe.expiryAlertDays} />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div>
              <SubmitButton pending={pending}>Salvar preferências</SubmitButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const { state, onSubmit, pending } = useActionForm(action);
  const fe = state?.fieldErrors ?? {};
  return (
    <form
      onSubmit={(e) => {
        onSubmit(e);
      }}
      noValidate
    >
      <Card>
        <CardHeader title="Senha" description="Ao trocar a senha, as outras sessões são encerradas." />
        <CardBody className="grid gap-4">
          <Field label="Senha atual" htmlFor="current" error={fe.current}>
            <Input id="current" name="current" type="password" autoComplete="current-password" aria-invalid={!!fe.current} />
          </Field>
          <Field label="Nova senha" htmlFor="next" error={fe.next} hint="Mínimo de 10 caracteres, com letras e números.">
            <Input id="next" name="next" type="password" autoComplete="new-password" aria-invalid={!!fe.next} />
          </Field>
          <Field label="Confirmar nova senha" htmlFor="confirm" error={fe.confirm}>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" aria-invalid={!!fe.confirm} />
          </Field>
          <FormMessage state={state} />
          <div>
            <SubmitButton pending={pending}>Alterar senha</SubmitButton>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
