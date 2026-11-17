"use client";

import { useState, useTransition } from "react";
import { Loader2, Pause, Play, RefreshCw, Share2, Trash2 } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { deleteRouteAlert, searchFlights, setRouteAlertActive } from "@/server/actions/flights";

export function SearchFlightsButton({ disabled, reason }: { disabled?: boolean; reason?: string }) {
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
            setResult(await searchFlights());
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
        {pending ? "Buscando voos…" : "Buscar voos agora"}
      </Button>
      {pending && <p className="text-xs text-muted" aria-live="polite">Leva de 1 a 3 minutos. Pode continuar usando o app.</p>}
      {!pending && disabled && reason && <p className="text-xs text-muted">{reason}</p>}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cx("max-w-sm text-xs", result.ok ? "text-good-ink" : "text-critical-ink")}>
          {result.message}
        </p>
      )}
    </div>
  );
}

export function AlertRowActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => start(() => setRouteAlertActive(id, !active))}
        aria-label={active ? "Pausar aviso" : "Reativar aviso"}
        title={active ? "Pausar" : "Reativar"}
      >
        {active ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm("Excluir este aviso?")) start(() => deleteRouteAlert(id));
        }}
        aria-label="Excluir aviso"
        title="Excluir"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </div>
  );
}

/** Compartilhar pelo celular (Web Share); no computador, copia o texto. */
export function ShareDeal({ text, url }: { text: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ text, url });
          else {
            await navigator.clipboard.writeText(`${text}\n${url}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        } catch {
          // compartilhamento cancelado
        }
      }}
    >
      <Share2 className="size-3.5" aria-hidden /> {copied ? "Copiado" : "Compartilhar"}
    </Button>
  );
}
