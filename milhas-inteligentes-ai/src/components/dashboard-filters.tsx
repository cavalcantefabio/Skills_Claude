"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cx, Select } from "@/components/ui";

const PERIOD_OPTIONS = [
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
  { value: "24m", label: "24 meses" },
];

export function DashboardFilters({
  period,
  accountId,
  accounts,
}: {
  period: string;
  accountId: string | null;
  accounts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return (
    <div className={cx("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")}>
      <div className="inline-flex rounded-xl border border-line bg-surface p-0.5" role="radiogroup" aria-label="Período">
        {PERIOD_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={period === o.value}
            onClick={() => update("periodo", o.value)}
            className={cx(
              "h-8 rounded-lg px-3 text-[13px] transition-colors",
              period === o.value ? "bg-surface-3 font-medium text-ink" : "text-ink-2 hover:text-ink",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <label className="sr-only" htmlFor="filtro-programa">
        Programa
      </label>
      <Select
        id="filtro-programa"
        value={accountId ?? ""}
        onChange={(e) => update("programa", e.target.value || null)}
        className="h-9 w-56 text-[13px]"
      >
        <option value="">Todos os programas</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
