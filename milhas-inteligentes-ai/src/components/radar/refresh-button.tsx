"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { refreshRadar } from "@/server/actions/radar";

export function RefreshRadarButton({ disabled, reason }: { disabled?: boolean; reason?: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        disabled={pending || disabled}
        title={disabled ? reason : undefined}
        onClick={() =>
          start(async () => {
            setResult(null);
            setResult(await refreshRadar());
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        {pending ? "Pesquisando na web…" : "Atualizar radar"}
      </Button>
      {pending && <p className="text-xs text-muted" aria-live="polite">Isso leva de 1 a 3 minutos. Pode continuar usando o app em outra aba.</p>}
      {!pending && disabled && reason && <p className="text-xs text-muted">{reason}</p>}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cx("max-w-sm text-xs", result.ok ? "text-good-ink" : "text-critical-ink")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
