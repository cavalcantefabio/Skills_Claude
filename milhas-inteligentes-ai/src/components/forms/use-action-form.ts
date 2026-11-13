"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import type { ActionState } from "@/server/services/errors";

/**
 * Envia o formulário para uma server action sem o reset automático do React 19
 * (que apagaria o que a pessoa digitou quando há erro de validação).
 */
export function useActionForm(action: (s: ActionState, f: FormData) => Promise<ActionState>) {
  const [state, dispatch, actionPending] = useActionState(action, null);
  const [transitionPending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(() => dispatch(fd));
  };
  return { state, onSubmit, pending: actionPending || transitionPending };
}
