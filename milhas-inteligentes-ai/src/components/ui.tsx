import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Construction, type LucideIcon } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ---------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"section">) {
  return (
    <section
      className={cx("rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("px-5 pb-5 pt-4 sm:px-6", className)}>{children}</div>;
}

/* ---------------------------------------------------------------- */

const buttonStyles = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "border border-line-strong bg-surface text-critical-ink hover:bg-critical-soft",
} as const;

export type ButtonVariant = keyof typeof buttonStyles;

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    size === "md" ? "h-10 px-4 text-sm" : "h-8 px-3 text-[13px]",
    buttonStyles[variant],
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={cx(buttonClass(variant, size), className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <Link className={cx(buttonClass(variant, size), className)} {...rest} />;
}

/* ---------------------------------------------------------------- */

const inputBase =
  "rounded-xl border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 aria-invalid:border-critical";

/** Largura total por padrão, a menos que o chamador defina uma largura. */
const widthOf = (className?: string) => (/(^|\s)(\w+:)?(w|min-w)-/.test(className ?? "") ? undefined : "w-full");

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(inputBase, "h-10", widthOf(className), className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cx(inputBase, "h-10 pr-8", widthOf(className), className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputBase, "min-h-20 w-full py-2", className)} {...rest} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string[] | string;
  children: ReactNode;
  className?: string;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {msg ? (
        <p className="text-xs text-critical-ink" role="alert">
          {msg}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */

const badgeTones = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent-soft-ink",
  good: "bg-good-soft text-good-ink",
  warning: "bg-warning-soft text-warning-ink",
  critical: "bg-critical-soft text-critical-ink",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-2">{label}</p>
        {Icon && (
          <span className="grid size-8 place-items-center rounded-lg bg-surface-2 text-ink-2">
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-3 text-[26px] font-semibold leading-none tracking-tight text-ink">{value}</p>
      {sub && <div className="mt-2 text-xs text-muted">{sub}</div>}
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-xl bg-surface-2 text-ink-2">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Aviso padrão para funcionalidades que ainda não existem. */
export function InDevelopment({
  title,
  planned,
  children,
}: {
  title: string;
  planned: string[];
  children?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-4 border-b border-line bg-warning-soft/60 px-6 py-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-warning-ink">
          <Construction className="size-5" aria-hidden />
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            <Badge tone="warning">Em desenvolvimento</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            Este módulo ainda não está operacional. Nada nesta página executa buscas, automações ou recomendações.
          </p>
        </div>
      </div>
      <div className="px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Planejado</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {planned.map((p) => (
            <li key={p} className="flex gap-2 text-sm text-ink-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </Card>
  );
}

export function FormMessage({ state }: { state: { ok: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={cx(
        "rounded-xl px-3 py-2 text-sm",
        state.ok ? "bg-good-soft text-good-ink" : "bg-critical-soft text-critical-ink",
      )}
    >
      {state.message}
    </p>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("-mx-5 overflow-x-auto sm:-mx-6", className)}>
      <table className="w-full min-w-[560px] text-sm">{children}</table>
    </div>
  );
}

export const th = "px-5 py-2.5 text-left text-xs font-medium text-muted first:pl-5 sm:first:pl-6 last:pr-5 sm:last:pr-6";
export const td = "whitespace-nowrap border-t border-line px-5 py-3 text-ink first:pl-5 sm:first:pl-6 last:pr-5 sm:last:pr-6";
