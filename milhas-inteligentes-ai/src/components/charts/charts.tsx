"use client";

import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table2, LineChart as LineIcon } from "lucide-react";
import { Card, CardBody, CardHeader, cx, td, th } from "@/components/ui";
import { formatBRL, formatCompact, formatPoints, monthLabel } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Cores: papel → variável CSS. A cor segue a entidade, nunca o rank.  */
/* ------------------------------------------------------------------ */

export const seriesColor = (slot: number) => (slot >= 0 && slot < 8 ? `var(--series-${slot + 1})` : "var(--muted)");

export type Series = { key: string; name: string; slot: number; unit?: string };
export type ValueKind = "points" | "brl" | "count";

const fmt = (kind: ValueKind, v: number) =>
  kind === "brl" ? formatBRL(v) : kind === "count" ? formatPoints(v) : formatPoints(v);
const fmtAxis = (kind: ValueKind, v: number) => (kind === "brl" ? `R$ ${formatCompact(v)}` : formatCompact(v));

const axisProps = {
  stroke: "var(--axis)",
  tick: { fill: "var(--muted)", fontSize: 11 },
  tickLine: false,
} as const;

/* ------------------------------------------------------------------ */

function ChartTooltip({
  active,
  payload,
  label,
  kind,
  series,
}: {
  active?: boolean;
  payload?: readonly { dataKey?: unknown; value?: unknown; name?: unknown }[];
  label?: unknown;
  kind: ValueKind;
  series: Series[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-ink">{typeof label === "string" && /^\d{4}-\d{2}$/.test(label) ? monthLabel(label) : String(label ?? "")}</p>
      <ul className="flex flex-col gap-1">
        {payload.map((p) => {
          const s = series.find((x) => x.key === p.dataKey);
          return (
            <li key={String(p.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-2">
                <span className="size-2 rounded-full" style={{ background: seriesColor(s?.slot ?? 0) }} aria-hidden />
                {s?.name ?? String(p.name)}
              </span>
              <span className="tabular font-medium text-ink">
                {fmt(kind, Number(p.value))}
                {kind === "points" && s?.unit ? <span className="ml-1 font-normal text-muted">{s.unit}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legenda">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs text-ink-2">
          <span className="h-0.5 w-3 rounded-full" style={{ background: seriesColor(s.slot), height: 3 }} aria-hidden />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */

export type TableView = { columns: string[]; rows: (string | number)[][] };

export function ChartCard({
  title,
  description,
  table,
  legend,
  empty,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  table: TableView;
  legend?: Series[];
  empty?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={cx("flex flex-col", className)}>
      <CardHeader
        title={title}
        description={description}
        actions={
          !empty && (
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
              aria-pressed={showTable}
            >
              {showTable ? <LineIcon className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
              {showTable ? "Ver gráfico" : "Ver tabela"}
            </button>
          )
        }
      />
      <CardBody className="flex flex-1 flex-col gap-4">
        {empty ? (
          <div className="grid flex-1 place-items-center py-10 text-center text-sm text-muted">{empty}</div>
        ) : showTable ? (
          <div className="max-h-[280px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr>
                  {table.columns.map((c, i) => (
                    <th key={c} className={cx(th, "px-2 first:pl-0 sm:first:pl-0", i > 0 && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className={cx(td, "px-2 py-2 first:pl-0 sm:first:pl-0 tabular", j > 0 && "text-right")}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {legend && <Legend series={legend} />}
            <div className="h-[240px] w-full">{children}</div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function LineSeriesChart({
  data,
  series,
  kind = "points",
}: {
  data: Record<string, number | string>[];
  series: Series[];
  kind?: ValueKind;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} tickMargin={8} minTickGap={12} />
        <YAxis {...axisProps} axisLine={false} width={kind === "brl" ? 84 : 64} tickFormatter={(v) => fmtAxis(kind, v)} />
        <Tooltip
          cursor={{ stroke: "var(--axis)", strokeWidth: 1 }}
          content={(p) => <ChartTooltip {...p} kind={kind} series={series} />}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            dataKey={s.key}
            name={s.name}
            type="linear"
            stroke={seriesColor(s.slot)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--chart-surface)" }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({
  data,
  series,
  kind = "points",
  stacked = false,
}: {
  data: Record<string, number | string>[];
  series: Series[];
  kind?: ValueKind;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} tickMargin={8} minTickGap={8} />
        <YAxis {...axisProps} axisLine={false} width={kind === "brl" ? 84 : 64} tickFormatter={(v) => fmtAxis(kind, v)} allowDecimals={false} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          content={(p) => <ChartTooltip {...p} kind={kind} series={series} />}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={seriesColor(s.slot)}
            stackId={stacked ? "a" : undefined}
            radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
            stroke="var(--chart-surface)"
            strokeWidth={stacked ? 2 : 0}
            maxBarSize={28}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Barras horizontais ranqueadas, com rótulo de valor em texto (nunca na cor da série). */
export function RankedBars({
  items,
}: {
  items: { key: string; label: string; sub?: string; value: number; display: string; slot: number }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((i) => (
        <li key={i.key} className="group">
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-ink">
              {i.label}
              {i.sub && <span className="ml-1.5 text-muted">{i.sub}</span>}
            </span>
            <span className="tabular shrink-0 font-medium text-ink">{i.display}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-2" title={`${i.label}: ${i.display}`}>
            <div
              className="h-2 rounded-full transition-[width]"
              style={{ width: `${Math.max((i.value / max) * 100, 1.5)}%`, background: seriesColor(i.slot) }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
