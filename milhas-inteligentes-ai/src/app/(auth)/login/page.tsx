import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { login } from "@/server/auth/actions";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return <AuthForm mode="login" action={login} />;
}
