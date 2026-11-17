"use client";

import { useId, useMemo, useState } from "react";
import { ListFilter, X } from "lucide-react";
import { allPlaces, searchPlaces, type Place } from "@/lib/airports";
import { cx } from "@/components/ui";

const GROUPS: { kind: Place["kind"] | "brasil"; title: string }[] = [
  { kind: "brasil", title: "Regiões do Brasil" },
  { kind: "estado", title: "Estados" },
  { kind: "regiao", title: "Regiões do mundo" },
  { kind: "pais", title: "Países" },
  { kind: "cidade", title: "Cidades com mais de um aeroporto" },
  { kind: "aeroporto", title: "Aeroportos" },
];

/**
 * Escolha de lugares (região, estado, país, cidade ou aeroporto) com busca e lista completa.
 * Vários lugares podem ser escolhidos; o valor vai num campo oculto em JSON.
 */
export function PlacePicker({
  name,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  placeholder: string;
  value: Place[];
  onChange: (v: Place[]) => void;
  error?: string;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [list, setList] = useState(false);
  const results = useMemo(() => searchPlaces(q), [q]);
  const all = useMemo(() => allPlaces(), []);
  const add = (p: Place) => {
    if (!value.some((v) => v.label === p.label)) onChange([...value, p]);
    setQ("");
    setOpen(false);
  };
  const remove = (label: string) => onChange(value.filter((v) => v.label !== label));

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-semibold tracking-wider text-muted uppercase">
        {label}
      </label>
      <input type="hidden" name={name} value={JSON.stringify(value)} />
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label}: escolhidos`}>
          {value.map((p) => (
            <li key={p.label} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-[13px] text-accent-soft-ink">
              {p.label}
              <button type="button" onClick={() => remove(p.label)} className="grid size-5 place-items-center rounded-full hover:bg-accent/20" aria-label={`Remover ${p.label}`}>
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative flex gap-2">
        <input
          id={id}
          value={q}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${id}-list`}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (results[0]) add(results[0]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={value.length ? "Adicionar outro lugar…" : placeholder}
          className="h-12 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg px-4 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none aria-invalid:border-critical"
        />
        <button
          type="button"
          onClick={() => setList((v) => !v)}
          aria-expanded={list}
          className="grid size-12 shrink-0 place-items-center rounded-xl border border-line-strong bg-surface-2 text-ink-2 hover:text-ink"
          aria-label={`Ver lista de lugares para ${label.toLowerCase()}`}
        >
          <ListFilter className="size-5" aria-hidden />
        </button>
        {open && results.length > 0 && (
          <ul id={`${id}-list`} role="listbox" className="absolute top-13 right-14 left-0 z-20 max-h-64 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
            {results.map((p) => (
              <li key={p.label} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(p)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate">{p.label}</span>
                  <span className="shrink-0 text-xs text-muted">{p.codes.length > 1 ? `${p.codes.length} aeroportos` : p.codes[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && (
        <p className="text-xs text-critical-ink" role="alert">
          {error}
        </p>
      )}
      {list && (
        <div className="max-h-72 space-y-3 overflow-auto rounded-xl border border-line bg-bg p-3">
          {GROUPS.map((g) => {
            const items = all.filter((p) =>
              g.kind === "brasil" ? p.kind === "regiao" && p.label.startsWith("Região") || p.label === "Brasil (todos)" : g.kind === "regiao" ? p.kind === "regiao" && !p.label.startsWith("Região") : p.kind === g.kind && p.label !== "Brasil (todos)",
            );
            return (
              <div key={g.title}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{g.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((p) => {
                    const on = value.some((v) => v.label === p.label);
                    return (
                      <button
                        key={p.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => (on ? remove(p.label) : add(p))}
                        className={cx(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          on ? "border-accent bg-accent-soft text-accent-soft-ink" : "border-line text-ink-2 hover:border-line-strong hover:text-ink",
                        )}
                      >
                        {p.label.replace(/ \(todos: .*\)$/, "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
