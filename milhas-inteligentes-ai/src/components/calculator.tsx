"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, MinusCircle, Save } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, FormMessage, Input, cx } from "@/components/ui";
import { useActionForm } from "@/components/forms/use-action-form";
import { runCalculator, type CalculatorKey } from "@/lib/calculators";
import type { CalcField } from "@/lib/calculators/fields";
import type { ActionState } from "@/server/services/errors";

const verdictUi = {
  favoravel: { tone: "good", icon: CheckCircle2, label: "Favorável" },
  neutro: { tone: "neutral", icon: MinusCircle, label: "Neutro" },
  desfavoravel: { tone: "critical", icon: CircleAlert, label: "Desfavorável" },
} as const;

export function Calculator({
  calcKey,
  title,
  description,
  fields,
  initial,
  save,
}: {
  calcKey: CalculatorKey;
  title: string;
  description: string;
  fields: CalcField[];
  initial: Record<string, string>;
  save: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const run = useMemo(() => runCalculator(calcKey, values), [calcKey, values]);
  const { state, onSubmit, pending } = useActionForm(save);
  const errors = !run.ok ? run.fieldErrors : {};
  const serverErrors = state?.fieldErrors ?? {};

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader title={title} description={description} />
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const err = touched[f.name] || state ? (errors[f.name] ?? serverErrors[f.name]) : undefined;
              return (
                <Field
                  key={f.name}
                  label={f.optional ? `${f.label} · opcional` : f.label}
                  htmlFor={`calc-${f.name}`}
                  hint={f.hint}
                  error={err}
                >
                  <Input
                    id={`calc-${f.name}`}
                    name={f.name}
                    inputMode="decimal"
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    aria-invalid={!!err}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, [f.name]: true }))}
                  />
                </Field>
              );
            })}
            <div className="flex flex-col gap-3 border-t border-line pt-4 sm:col-span-2">
              <Field label="Nome da simulação" htmlFor="calc-title">
                <Input id="calc-title" name="title" placeholder="Ex.: Promoção Livelo → Smiles de março" maxLength={80} />
              </Field>
              <FormMessage state={state} />
              <div>
                <Button type="submit" variant="secondary" disabled={pending || !run.ok}>
                  <Save className="size-4" aria-hidden /> {pending ? "Salvando…" : "Salvar simulação"}
                </Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <Card aria-live="polite">
        <CardHeader title="Resultado" description="Atualiza enquanto você digita." />
        <CardBody>
          {!run.ok ? (
            <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-2">
              Preencha os campos obrigatórios com valores válidos para ver o resultado.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              <dl className="grid gap-3 sm:grid-cols-2">
                {run.result.metrics.map((m) => (
                  <div
                    key={m.label}
                    className={cx("rounded-xl border border-line p-4", m.emphasis && "border-accent/30 bg-accent-soft/50 sm:col-span-2")}
                  >
                    <dt className="text-xs text-ink-2">{m.label}</dt>
                    <dd className={cx("tabular mt-1 font-semibold tracking-tight", m.emphasis ? "text-3xl" : "text-lg")}>{m.value}</dd>
                  </div>
                ))}
              </dl>
              {run.result.verdict && (
                <div className="flex items-start gap-3 rounded-xl border border-line p-4">
                  {(() => {
                    const ui = verdictUi[run.result.verdict.tone];
                    const Icon = ui.icon;
                    return (
                      <>
                        <Icon
                          className={cx(
                            "mt-0.5 size-5 shrink-0",
                            ui.tone === "good" ? "text-good-ink" : ui.tone === "critical" ? "text-critical-ink" : "text-ink-2",
                          )}
                          aria-hidden
                        />
                        <div>
                          <Badge tone={ui.tone}>{ui.label}</Badge>
                          <p className="mt-1.5 text-sm text-ink">{run.result.verdict.text}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Como calculamos</p>
                <ol className="mt-3 flex flex-col gap-2">
                  {run.result.explanation.map((line, i) => (
                    <li key={i} className="flex gap-3 text-sm text-ink-2">
                      <span className="tabular grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-medium text-ink-2">
                        {i + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <p className="text-xs text-muted">
                Estimativa a partir dos valores informados. Paridades, bônus e preços mudam: confirme no site oficial antes de agir.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
