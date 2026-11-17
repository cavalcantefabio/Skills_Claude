import type { Metadata } from "next";
import { Download, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { changePassword, logoutEverywhere, updateProfile } from "@/server/actions/settings";
import { PasswordForm, ProfileForm } from "@/components/forms/settings-forms";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button, Card, CardBody, CardHeader, PageHeader, buttonClass } from "@/components/ui";
import { NotificationsCard } from "@/components/push/notifications-card";
import { vapidKeys } from "@/server/push/send";
import { countDevices } from "@/server/push/devices";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [{ publicKey }, devices] = await Promise.all([vapidKeys(), countDevices(user.id)]);
  return (
    <>
      <PageHeader title="Configurações" description="Perfil, preferências de cálculo, aparência e segurança." />
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex flex-col gap-4">
          <ProfileForm action={updateProfile} initial={user} />
          <Card>
            <CardHeader
              title="Seus dados"
              description="Baixe uma cópia dos seus dados para guardar como backup ou analisar no Excel."
            />
            <CardBody className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <a href="/api/exportar?arquivo=completo" download className={buttonClass("primary", "sm")}>
                  <Download className="size-3.5" aria-hidden /> Backup completo (JSON)
                </a>
                <a href="/api/exportar?arquivo=movimentacoes" download className={buttonClass("secondary", "sm")}>
                  <FileSpreadsheet className="size-3.5" aria-hidden /> Movimentações (CSV)
                </a>
                <a href="/api/exportar?arquivo=saldos" download className={buttonClass("secondary", "sm")}>
                  <FileSpreadsheet className="size-3.5" aria-hidden /> Saldos por validade (CSV)
                </a>
              </div>
              <p className="text-xs text-muted">
                O backup completo inclui programas, saldos, movimentações, cartões (com o limite de crédito), viagens, simulações,
                conversas com o agente e a última pesquisa do Radar. Não inclui sua senha. Guarde o arquivo em local seguro: ele contém
                dados financeiros.
              </p>
            </CardBody>
          </Card>
          <Card id="notificacoes">
            <CardHeader title="Notificações no celular" description="Avisos de voos encontrados pela busca automática." />
            <CardBody>
              <NotificationsCard vapidPublicKey={publicKey} devices={devices} />
            </CardBody>
          </Card>
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
