"use client";

import { useState, useTransition } from "react";
import { Loader2, Search } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { researchTripAction } from "@/server/actions/trips";

export function ResearchButton({ tripId }: { tripId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Pesquisar valores de referência na web? Custa cerca de US$ 0,30 e salva os resultados como estimativas, com a fonte.")) return;
          start(async () => setResult(await researchTripAction(tripId)));
        }}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Search className="size-3.5" aria-hidden />}
        {pending ? "Pesquisando referências…" : "Pesquisar referências (IA)"}
      </Button>
      {pending && <p className="text-xs text-muted">Leva de 1 a 2 minutos.</p>}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={cx("max-w-md text-xs", result.ok ? "text-good-ink" : "text-critical-ink")}>
          {result.message}
        </p>
      )}
    </div>
  );
}
