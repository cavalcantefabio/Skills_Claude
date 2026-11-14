"use client";

import { useEffect, useRef, useState } from "react";
import { useActionForm } from "./use-action-form";
import { Card, CardBody, CardHeader, Field, FormMessage, Input, Select } from "@/components/ui";
import { SubmitButton } from "./submit";
import { TX_LABEL } from "@/lib/labels";
import type { ActionState } from "@/server/services/errors";

type Account = { id: string; programName: string; unit: string; balance: number };
type CardOpt = { id: string; label: string; programId: string | null };
type Program = { programId: string };

const TYPES = ["acumulo", "bonus", "compra", "resgate", "expiracao", "ajuste"] as const;

function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    // Limpa só os campos digitados; seleções (controladas pelo React), datas e campos marcados com data-keep permanecem.
    if (!state?.ok || !ref.current) return;
    ref.current.querySelectorAll<HTMLInputElement>("input:not([type=date]):not([type=hidden]):not([data-keep])").forEach((i) => {
      i.value = "";
    });
  }, [state]);
  return ref;
}

export function TxForm({
  action,
  accounts,
  cards,
  defaultAccountId,
  today,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  accounts: (Account & Program)[];
  cards: CardOpt[];
  defaultAccountId?: string;
  today: string;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const ref = useResetOnSuccess(state);
  const [type, setType] = useState<(typeof TYPES)[number]>("acumulo");
  const [direction, setDirection] = useState("entrada");
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const fe = state?.fieldErrors ?? {};
  const account = accounts.find((a) => a.id === accountId);
  const isCredit = ["acumulo", "bonus", "compra"].includes(type) || (type === "ajuste" && direction === "entrada");
  const cardOptions = cards.filter((c) => !c.programId || c.programId === account?.programId);

  return (
    <form ref={ref} onSubmit={onSubmit} noValidate id="lancar" className="scroll-mt-6">
      <Card>
        <CardHeader title="Lançar movimentação" description="Acúmulos, bônus, compras, resgates, expirações e ajustes." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Programa" htmlFor="tx-account" error={fe.accountId}>
            <Select id="tx-account" name="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.programName} ({a.balance.toLocaleString("pt-BR")} {a.unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="tx-type" error={fe.type}>
            <Select id="tx-type" name="type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TX_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          {type === "ajuste" && (
            <Field label="Direção do ajuste" htmlFor="tx-dir">
              <Select id="tx-dir" name="direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
                <option value="entrada">Adicionar pontos</option>
                <option value="saida">Remover pontos</option>
              </Select>
            </Field>
          )}
          <Field label={`Quantidade (${account?.unit ?? "pontos"})`} htmlFor="tx-points" error={fe.points}>
            <Input id="tx-points" name="points" inputMode="numeric" aria-invalid={!!fe.points} />
          </Field>
          <Field label="Data" htmlFor="tx-date" error={fe.occurredOn}>
            <Input id="tx-date" name="occurredOn" type="date" defaultValue={today} max={today} aria-invalid={!!fe.occurredOn} />
          </Field>
          {isCredit && (
            <Field label="Validade dos pontos" htmlFor="tx-exp" error={fe.expiresAt} hint="Opcional, mas necessária para os alertas.">
              <Input id="tx-exp" name="expiresAt" type="date" aria-invalid={!!fe.expiresAt} />
            </Field>
          )}
          {type === "acumulo" && (
            <Field label="Cartão" htmlFor="tx-card" hint="Alimenta o gráfico de acúmulo por cartão.">
              <Select id="tx-card" name="cardId" defaultValue="">
                <option value="">Sem cartão</option>
                {cardOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {(type === "compra" || type === "resgate" || type === "bonus") && (
            <Field
              label={type === "resgate" ? "Taxas pagas (R$)" : type === "compra" ? "Valor pago (R$)" : "Custo (R$, opcional)"}
              htmlFor="tx-cost"
              error={fe.costBrl}
            >
              <Input id="tx-cost" name="costBrl" inputMode="decimal" aria-invalid={!!fe.costBrl} />
            </Field>
          )}
          {type === "resgate" && (
            <Field
              label="Economia obtida (R$)"
              htmlFor="tx-sav"
              error={fe.savingsBrl}
              hint="Preço em dinheiro evitado menos as taxas."
            >
              <Input id="tx-sav" name="savingsBrl" inputMode="decimal" aria-invalid={!!fe.savingsBrl} />
            </Field>
          )}
          <Field label="Descrição" htmlFor="tx-desc" error={fe.description} className="sm:col-span-2">
            <Input id="tx-desc" name="description" placeholder="Ex.: Passagem GRU–REC" />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div>
              <SubmitButton pending={pending}>Registrar</SubmitButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

export function TransferForm({
  action,
  accounts,
  today,
}: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  accounts: Account[];
  today: string;
}) {
  const { state, onSubmit, pending } = useActionForm(action);
  const ref = useResetOnSuccess(state);
  const fe = state?.fieldErrors ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} noValidate>
      <Card>
        <CardHeader
          title="Transferir entre programas"
          description="Registra a saída na origem e a entrada no destino, com paridade e bônus. Não executa a transferência no programa."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="De" htmlFor="tr-from" error={fe.fromAccountId}>
            <Select id="tr-from" name="fromAccountId" defaultValue={accounts[0]?.id}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.programName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Para" htmlFor="tr-to" error={fe.toAccountId}>
            <Select id="tr-to" name="toAccountId" defaultValue={accounts[1]?.id}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.programName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pontos enviados" htmlFor="tr-points" error={fe.points}>
            <Input id="tr-points" name="points" inputMode="numeric" aria-invalid={!!fe.points} />
          </Field>
          <Field label="Bônus (%)" htmlFor="tr-bonus" error={fe.bonusPct}>
            <Input id="tr-bonus" name="bonusPct" inputMode="decimal" defaultValue="0" data-keep aria-invalid={!!fe.bonusPct} />
          </Field>
          <Field label="Paridade" htmlFor="tr-rf" error={fe.ratioFrom ?? fe.ratioTo} hint="Pontos de origem : milhas de destino (ex.: 1:1, 2:1).">
            <div className="flex items-center gap-2">
              <Input id="tr-rf" name="ratioFrom" inputMode="decimal" defaultValue="1" data-keep aria-label="Pontos de origem" />
              <span className="text-muted">:</span>
              <Input name="ratioTo" inputMode="decimal" defaultValue="1" data-keep aria-label="Milhas de destino" />
            </div>
          </Field>
          <Field label="Data" htmlFor="tr-date" error={fe.occurredOn}>
            <Input id="tr-date" name="occurredOn" type="date" defaultValue={today} max={today} />
          </Field>
          <Field label="Validade no destino" htmlFor="tr-exp" error={fe.expiresAt} className="sm:col-span-2">
            <Input id="tr-exp" name="expiresAt" type="date" className="sm:w-56" />
          </Field>
          <div className="flex flex-col gap-3 sm:col-span-2">
            <FormMessage state={state} />
            <div>
              <SubmitButton pending={pending}>Registrar transferência</SubmitButton>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
