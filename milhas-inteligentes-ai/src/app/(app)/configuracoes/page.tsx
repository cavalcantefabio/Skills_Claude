import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { changePassword, logoutEverywhere, updateProfile } from "@/server/actions/settings";
import { PasswordForm, ProfileForm } from "@/components/forms/settings-forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, Card, CardBody, CardHeader, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Configurações" description="Perfil, preferências de cálculo, aparência e segurança." />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <ProfileForm action={updateProfile} initial={user} />
          <Card>
            <CardHeader title="Aparência" description="Claro, escuro ou seguir o sistema." />
            <CardBody>
              <ThemeToggle />
            </CardBody>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <PasswordForm action={changePassword} />
          <Card>
            <CardHeader title="Sessões" description="Encerra o acesso em todos os dispositivos, inclusive neste." />
            <CardBody>
              <form action={logoutEverywhere}>
                <Button type="submit" variant="secondary">
                  Sair de todos os dispositivos
                </Button>
              </form>
            </CardBody>
          </Card>
          <Card className="p-5">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-good-ink" aria-hidden />
              <div className="text-sm text-ink-2">
                <p className="font-medium text-ink">Como protegemos seus dados</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Não pedimos nem guardamos senhas de bancos, cartões ou programas de fidelidade.</li>
                  <li>Não guardamos número, CVV nem validade de cartões.</li>
                  <li>O limite de crédito é criptografado (AES-256-GCM).</li>
                  <li>Sua senha é guardada só como hash bcrypt.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
