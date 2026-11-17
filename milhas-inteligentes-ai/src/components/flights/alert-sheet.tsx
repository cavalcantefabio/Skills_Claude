"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BellPlus, Loader2, X } from "lucide-react";
import { saveRouteAlert } from "@/server/actions/flights";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button, cx } from "@/components/ui";
import { PlacePicker } from "./place-picker";
import type { Place } from "@/lib/airports";
import { monthOptions, wouldHaveFired, type AlertCabin, type AlertPay, type DateMode, type DealLite } from "@/lib/flight-alerts";
import { parseNumber } from "@/lib/validation";

export type AlertInitial = {
  id?: string;
  origins: Place[];
  destinations: Place[];
  dateMode: DateMode;
  month: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  cabin: AlertCabin;
  pay: AlertPay;
  maxMiles: number | null;
  maxCashBrl: number | null;
};

export const EMPTY_ALERT: AlertInitial = {
  origins: [],
  destinations: [],
  dateMode: "qualquer",
  month: null,
  dateFrom: null,
  dateTo: null,
  cabin: "qualquer",
  pay: "qualquer",
  maxMiles: null,
  maxCashBrl: null,
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cx(
        "rounded-full border px-4 py-2 text-[14px] transition-colors",
        on ? "border-accent bg-accent-soft font-semibold text-accent-soft-ink" : "border-line-strong text-ink-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <fieldset className="space-y-2.5">
    <legend className="mb-2.5 text-xs font-semibold tracking-wider text-muted uppercase">{title}</legend>
    {children}
  </fieldset>
);

/** Botão que abre o painel "Novo aviso" (de baixo para cima no celular, centrado no computador). */
export function AlertSheet({
  today,
  previewDeals,
  initial = EMPTY_ALERT,
  trigger,
  triggerClassName,
  triggerVariant = "primary",
}: {
  today: string;
  previewDeals: (DealLite & { foundOn: string })[];
  initial?: AlertInitial;
  trigger: ReactNode;
  triggerClassName?: string;
  triggerVariant?: "primary" | "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <Button type="button" variant={triggerVariant} size="sm" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      {open && <Sheet today={today} previewDeals={previewDeals} initial={initial} onClose={close} />}
    </>
  );
}

function Sheet({ today, previewDeals, initial, onClose }: { today: string; previewDeals: (DealLite & { foundOn: string })[]; initial: AlertInitial; onClose: () => void }) {
  const [origins, setOrigins] = useState<Place[]>(initial.origins);
  const [destinations, setDestinations] = useState<Place[]>(initial.destinations);
  const [dateMode, setDateMode] = useState<DateMode>(initial.dateMode);
  const [month, setMonth] = useState<string | null>(initial.month);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initial.dateTo ?? "");
  const [cabin, setCabin] = useState<AlertCabin>(initial.cabin);
  const [pay, setPay] = useState<AlertPay>(initial.pay);
  const [showCap, setShowCap] = useState(initial.maxMiles != null || initial.maxCashBrl != null);
  const [maxMiles, setMaxMiles] = useState(initial.maxMiles != null ? String(initial.maxMiles) : "");
  const [maxCash, setMaxCash] = useState(initial.maxCashBrl != null ? String(initial.maxCashBrl) : "");
  const { state, onSubmit, pending } = useActionForm(saveRouteAlert.bind(null, initial.id ?? null));
  const panel = useRef<HTMLDivElement>(null);
  const months = useMemo(() => monthOptions(today, 6), [today]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (state?.ok) {
      const t = setTimeout(onClose, 1400);
      return () => clearTimeout(t);
    }
  }, [state, onClose]);

  const num = (s: string) => {
    const v = parseNumber(s);
    return typeof v === "number" && v > 0 ? v : null;
  };
  const criteria = {
    originCodes: [...new Set(origins.flatMap((p) => p.codes))],
    destinationCodes: [...new Set(destinations.flatMap((p) => p.codes))],
    dateMode,
    month,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    cabin,
    pay,
    maxMiles: showCap && pay !== "dinheiro" ? num(maxMiles) : null,
    maxCashBrl: showCap && pay !== "milhas" ? num(maxCash) : null,
  };
  const fired = wouldHaveFired(criteria, previewDeals, today);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-sheet-title"
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl border border-line bg-surface shadow-2xl focus:outline-none sm:rounded-3xl"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line-strong sm:hidden" aria-hidden />
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <h2 id="alert-sheet-title" className="text-xl font-semibold text-ink">
            {initial.id ? "Editar aviso" : "Novo aviso"}
          </h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-surface-2 text-ink-2 hover:text-ink" aria-label="Fechar">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pt-2 pb-4">
            <PlacePicker name="origins" label="Saindo de" placeholder="Região, estado ou cidade (ex: Sudeste)" value={origins} onChange={setOrigins} error={fe?.origins?.[0]} />
            <PlacePicker name="destinations" label="Indo para" placeholder="Cidade, aeroporto ou região (ex: Europa)" value={destinations} onChange={setDestinations} error={fe?.destinations?.[0]} />
            <p className="-mt-3 text-xs text-muted">Deixe um dos dois vazio para “qualquer lugar”.</p>

            <Section title="Data do voo">
              <input type="hidden" name="dateMode" value={dateMode} />
              <input type="hidden" name="month" value={dateMode === "mes" ? (month ?? "") : ""} />
              <div className="flex flex-wrap gap-2">
                <Chip on={dateMode === "qualquer"} onClick={() => setDateMode("qualquer")}>Qualquer data</Chip>
                <Chip on={dateMode === "prox30"} onClick={() => setDateMode("prox30")}>Próximos 30 dias</Chip>
                <Chip on={dateMode === "prox90"} onClick={() => setDateMode("prox90")}>Próximos 3 meses</Chip>
                {months.map((m) => (
                  <Chip
                    key={m.value}
                    on={dateMode === "mes" && month === m.value}
                    onClick={() => {
                      setDateMode("mes");
                      setMonth(m.value);
                    }}
                  >
                    {m.label}
                  </Chip>
                ))}
                <Chip on={dateMode === "datas"} onClick={() => setDateMode("datas")}>Escolher datas</Chip>
              </div>
              {dateMode === "datas" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="space-y-1 text-xs text-muted">
                    De
                    <input type="date" name="dateFrom" min={today} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink" />
                  </label>
                  <label className="space-y-1 text-xs text-muted">
                    Até
                    <input type="date" name="dateTo" min={dateFrom || today} value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink" />
                  </label>
                </div>
              )}
              {(fe?.dateMode || fe?.dateFrom || fe?.dateTo) && (
                <p className="text-xs text-critical-ink" role="alert">
                  {(fe.dateMode ?? fe.dateFrom ?? fe.dateTo)?.[0]}
                </p>
              )}
            </Section>

            <Section title="Cabine">
              <input type="hidden" name="cabin" value={cabin} />
              <div className="flex flex-wrap gap-2">
                <Chip on={cabin === "qualquer"} onClick={() => setCabin("qualquer")}>Qualquer</Chip>
                <Chip on={cabin === "economica"} onClick={() => setCabin("economica")}>Econômica</Chip>
                <Chip on={cabin === "executiva"} onClick={() => setCabin("executiva")}>Executiva</Chip>
              </div>
            </Section>

            <Section title="Pago com">
              <input type="hidden" name="pay" value={pay} />
              <div className="flex flex-wrap gap-2">
                <Chip on={pay === "qualquer"} onClick={() => setPay("qualquer")}>Milhas ou dinheiro</Chip>
                <Chip on={pay === "milhas"} onClick={() => setPay("milhas")}>Só milhas</Chip>
                <Chip on={pay === "dinheiro"} onClick={() => setPay("dinheiro")}>Só dinheiro</Chip>
              </div>
            </Section>

            <Section title="Preço máximo">
              {!showCap ? (
                <Chip on={false} onClick={() => setShowCap(true)}>+ Definir um teto</Chip>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pay !== "dinheiro" && (
                    <label className="space-y-1 text-xs text-muted">
                      Até quantas milhas (por trecho, por pessoa)
                      <input name="maxMiles" inputMode="numeric" placeholder="ex: 40.000" value={maxMiles} onChange={(e) => setMaxMiles(e.target.value)} aria-invalid={fe?.maxMiles ? true : undefined} className="h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink aria-invalid:border-critical" />
                    </label>
                  )}
                  {pay !== "milhas" && (
                    <label className="space-y-1 text-xs text-muted">
                      Até quantos reais (por trecho, por pessoa)
                      <input name="maxCashBrl" inputMode="decimal" placeholder="ex: 1.200" value={maxCash} onChange={(e) => setMaxCash(e.target.value)} aria-invalid={fe?.maxCashBrl ? true : undefined} className="h-11 w-full rounded-xl border border-line-strong bg-bg px-3 text-sm text-ink aria-invalid:border-critical" />
                    </label>
                  )}
                  {(fe?.maxMiles || fe?.maxCashBrl) && (
                    <p className="text-xs text-critical-ink sm:col-span-2" role="alert">
                      {(fe.maxMiles ?? fe.maxCashBrl)?.[0]}
                    </p>
                  )}
                  <button type="button" onClick={() => { setShowCap(false); setMaxMiles(""); setMaxCash(""); }} className="justify-self-start text-xs text-ink-2 underline underline-offset-2 sm:col-span-2">
                    Remover teto
                  </button>
                </div>
              )}
            </Section>

            <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2" aria-live="polite">
              {previewDeals.length
                ? `Com os voos encontrados aqui nos últimos 30 dias, este aviso teria tocado ${fired} ${fired === 1 ? "vez" : "vezes"}.`
                : "Ainda não há voos encontrados aqui para testar o aviso. Ele passa a valer na próxima busca."}
            </p>
            {state?.message && (
              <p role={state.ok ? "status" : "alert"} className={cx("text-sm", state.ok ? "text-good-ink" : "text-critical-ink")}>
                {state.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-line px-6 py-4">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-[15px] font-medium text-ink-2 hover:text-ink">
              Cancelar
            </button>
            <button type="submit" disabled={pending} className="flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-60">
              {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <BellPlus className="size-5" aria-hidden />}
              {initial.id ? "Salvar aviso" : "Criar aviso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
