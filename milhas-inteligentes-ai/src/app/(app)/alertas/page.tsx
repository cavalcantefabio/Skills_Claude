import type { Metadata } from "next";
import Link from "next/link";
import { BellOff, ChevronRight, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { computeAlerts } from "@/server/services/alerts";
import { AskAgent } from "@/components/agent/ask-agent";
import { Badge, Card, CardBody, CardHeader, EmptyState, InDevelopment, PageHeader, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Alertas" };

const ui = {
  critical: { icon: CircleAlert, label: "Urgente", tone: "critical", color: "text-critical-ink" },
  warning: { icon: TriangleAlert, label: "Atenção", tone: "warning", color: "text-warning-ink" },
  info: { icon: Info, label: "Sugestão", tone: "neutral", color: "text-ink-2" },
} as const;

export default async function AlertsPage() {
  const user = await requireUser();
  const alerts = await computeAlerts(user.id, user.expiryAlertDays);
  return (
    <>
      <PageHeader
        title="Alertas"
        description={`Calculados a partir dos seus dados: vencimentos nos próximos ${user.expiryAlertDays} dias, clubes, viagens e cadastros incompletos.`}
      />
      <Card>
        <CardHeader title={`${alerts.length} alerta(s) ativo(s)`} description="A janela de vencimento pode ser ajustada em Configurações." />
        <CardBody>
          {alerts.length === 0 ? (
            <EmptyState icon={BellOff} title="Nenhum alerta no momento" description="Seus pontos não vencem na janela configurada." />
          ) : (
            <ul className="-mx-2 flex flex-col">
              {alerts.map((a) => {
                const u = ui[a.severity];
                const Icon = u.icon;
                return (
                  <li key={a.id} className="flex flex-col gap-1 rounded-xl hover:bg-surface-2 sm:flex-row sm:items-center">
                    <Link href={a.href} className="group flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2 py-3">
                      <Icon className={cx("mt-0.5 size-5 shrink-0", u.color)} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{a.title}</p>
                          <Badge tone={u.tone}>{u.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-ink-2">{a.description}</p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted group-hover:text-ink" aria-hidden />
                    </Link>
                    <AskAgent question={a.question} variant="ghost" className="mb-2 ml-10 self-start sm:mb-0 sm:ml-0 sm:mr-2 sm:self-center" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
      <div className="mt-6">
        <InDevelopment
          title="Notificações e alertas de oportunidades"
          planned={[
            "Receber os alertas por e-mail ou notificação",
            "Alertas de promoções de transferência e compra vindos do Radar",
            "Regras personalizadas (ex.: avisar quando a Smiles tiver bônus acima de 80%)",
            "Resumo semanal",
          ]}
        />
      </div>
    </>
  );
}
