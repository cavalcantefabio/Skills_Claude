import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { signup } from "@/server/auth/actions";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return <AuthForm mode="cadastro" action={signup} />;
}
