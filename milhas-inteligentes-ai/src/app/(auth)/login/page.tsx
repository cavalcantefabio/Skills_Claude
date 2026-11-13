import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { login } from "@/server/auth/actions";
import { signupOpen } from "@/server/auth/signup";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  return <AuthForm mode="login" action={login} showSignupLink={await signupOpen()} />;
}
