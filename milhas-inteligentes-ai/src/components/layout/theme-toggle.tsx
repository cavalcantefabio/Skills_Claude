"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cx } from "@/components/ui";

const options = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Evita divergência de hidratação: só conhece o tema no cliente.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cx("inline-flex rounded-xl border border-line bg-surface p-0.5", className)}
    >
      {options.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cx(
              "grid size-8 place-items-center rounded-lg transition-colors",
              active ? "bg-surface-3 text-ink" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
