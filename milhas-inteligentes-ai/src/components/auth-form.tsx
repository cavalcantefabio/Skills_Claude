"use client";

import Link from "next/link";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button, Field, FormMessage, Input } from "@/components/ui";
import type { ActionState } from "@/server/services/errors";

type Props = {
  mode: "login" | "cadastro";
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  /** Mostra o link "Criar conta" na tela de login (só quando o cadastro está aberto). */
  showSignupLink?: boolean;
};

export function AuthForm({ mode, action, showSignupLink = true }: Props) {
  const { state, onSubmit, pending } = useActionForm(action);
  const fe = state?.fieldErrors ?? {};
  const isSignup = mode === "cadastro";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">{isSignup ? "Criar conta" : "Entrar"}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {isSignup ? "Comece a organizar seus pontos e milhas." : "Acesse seu painel de pontos e milhas."}
        </p>
      </div>
      {isSignup && (
        <Field label="Nome" htmlFor="name" error={fe.name}>
          <Input id="name" name="name" autoComplete="name" required aria-invalid={!!fe.name} />
        </Field>
      )}
      <Field label="E-mail" htmlFor="email" error={fe.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={!!fe.email} />
      </Field>
      <Field
        label="Senha"
        htmlFor="password"
        error={fe.password}
        hint={isSignup ? "Mínimo de 10 caracteres, com letras e números." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          aria-invalid={!!fe.password}
        />
      </Field>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? "Aguarde…" : isSignup ? "Criar conta" : "Entrar"}
      </Button>
      {(isSignup || showSignupLink) && (
      <p className="text-center text-sm text-ink-2">
        {isSignup ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link href={isSignup ? "/login" : "/cadastro"} className="font-medium text-accent hover:underline">
          {isSignup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
      )}
    </form>
  );
}
