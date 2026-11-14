import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { signup } from "@/server/auth/actions";
import { signupOpen } from "@/server/auth/signup";

export const metadata: Metadata = { title: "Criar conta" };

export default async function SignupPage() {
  if (!(await signupOpen())) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-surface-2 text-ink-2">
          <Lock className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold">Cadastro fechado</h1>
        <p className="mt-1 text-sm text-ink-2">Este app é de uso pessoal e já tem uma conta.</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
          Ir para o login
        </Link>
      </div>
    );
  }
  return <AuthForm mode="cadastro" action={signup} />;
}
