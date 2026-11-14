import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { requireUser } from "@/server/auth/session";
import { db, schema } from "@/server/db";
import { deleteSimulation, saveSimulation } from "@/server/actions/simulations";
import { Calculator } from "@/components/calculator";
import { DeleteButton } from "@/components/forms/submit";
import { Card, CardBody, CardHeader, PageHeader, buttonClass, cx } from "@/components/ui";
import { CALC_META } from "@/lib/calculators/fields";
import type { CalculatorKey } from "@/lib/calculators";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Calculadoras" };

const KEYS = Object.keys(CALC_META) as CalculatorKey[];

export default async function CalculatorsPage({ searchParams }: PageProps<"/calculadoras">) {
  const user = await requireUser();
  const sp = await searchParams;
  const key = (typeof sp.c === "string" && KEYS.includes(sp.c as CalculatorKey) ? sp.c : KEYS[0]) as CalculatorKey;
  const meta = CALC_META[key];

  const sims = await db
    .select()
    .from(schema.simulations)
    .where(and(eq(schema.simulations.userId, user.id), eq(schema.simulations.calculator, key)))
    .orderBy(desc(schema.simulations.createdAt))
    .limit(30);

  const loaded = typeof sp.sim === "string" ? sims.find((s) => s.id === sp.sim) : undefined;
  const initial: Record<string, string> = Object.fromEntries(meta.fields.map((f) => [f.name, f.def ?? ""]));
  if (key === "retorno_cartao") initial.cotacaoDolar = String(user.usdRateBrl);
  if (loaded) {
    for (const f of meta.fields) {
      const v = (loaded.input as Record<string, unknown>)[f.name];
      initial[f.name] = v == null ? "" : String(v);
    }
  }

  return (
    <>
      <PageHeader
        title="Calculadoras"
        description="Cálculos transparentes, com o passo a passo de cada resultado. Salve simulações para comparar depois."
      />
      <nav aria-label="Calculadoras" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
        {KEYS.map((k) => (
          <Link
            key={k}
            href={`/calculadoras?c=${k}`}
            aria-current={k === key ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-xl px-3.5 py-2 text-[13px] transition-colors",
              k === key ? "bg-surface-3 font-medium text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {CALC_META[k].short}
          </Link>
        ))}
      </nav>

      <Calculator
        key={`${key}-${loaded?.id ?? "novo"}`}
        calcKey={key}
        title={meta.title}
        description={meta.description}
        fields={meta.fields}
        initial={initial}
        save={saveSimulation.bind(null, key)}
      />

      <Card className="mt-4">
        <CardHeader title="Simulações salvas" description={`${meta.title}: as 30 mais recentes.`} />
        <CardBody>
          {sims.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Nenhuma simulação salva nesta calculadora.</p>
          ) : (
            <ul className="divide-y divide-line">
              {sims.map((s) => {
                const result = s.result as { metrics: { label: string; value: string }[] };
                return (
                  <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted">
                        {formatDate(s.createdAt.toISOString())} · {result.metrics[0]?.label}: <span className="tabular text-ink-2">{result.metrics[0]?.value}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-start gap-2">
                      <Link href={`/calculadoras?c=${key}&sim=${s.id}`} className={buttonClass("secondary", "sm")}>
                        Abrir
                      </Link>
                      <DeleteButton action={deleteSimulation} id={s.id} confirmText="Excluir esta simulação?" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
