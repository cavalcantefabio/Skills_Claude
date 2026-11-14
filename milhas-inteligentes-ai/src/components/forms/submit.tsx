"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  pending: explicit,
}: {
  children: React.ReactNode;
  pendingText?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = explicit ?? status.pending;
  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}

/** Botão de exclusão com confirmação; mostra o motivo quando a regra de negócio recusa. */
export function DeleteButton({
  action,
  id,
  confirmText,
  label = "Excluir",
}: {
  action: (f: FormData) => Promise<{ ok: boolean; message?: string } | null | void>;
  id: string;
  confirmText: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          setError(null);
          const fd = new FormData();
          fd.set("id", id);
          start(async () => {
            const res = await action(fd);
            if (res && !res.ok) setError(res.message ?? "Não foi possível excluir.");
          });
        }}
      >
        <Trash2 className="size-3.5" aria-hidden /> {pending ? "Excluindo…" : label}
      </Button>
      {error && (
        <p role="alert" className="max-w-56 whitespace-normal text-right text-xs text-critical-ink">
          {error}
        </p>
      )}
    </div>
  );
}
