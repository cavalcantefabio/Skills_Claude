"use client";

import { useState, useTransition } from "react";
import { CalendarX } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { writeOffExpiredAction } from "@/server/actions/transactions";

/** Registra a expiração dos lotes vencidos de um programa, com confirmação. */
export function WriteOffButton({ accountId, points, unit }: { accountId: string; points: number; unit: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const label = points.toLocaleString("pt-BR");
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Registrar a expiração de ${label} ${unit} vencidos? Eles saem do histórico de saldo como "Expiração".`)) return;
          start(async () => setResult(await writeOffExpiredAction(accountId)));
        }}
      >
        <CalendarX className="size-3.5" aria-hidden /> {pending ? "Registrando…" : `Registrar expiração de ${label} ${unit}`}
      </Button>
      {result?.message && (
        <p role={result.ok ? "status" : "alert"} className={cx("text-xs", result.ok ? "text-good-ink" : "text-critical-ink")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
