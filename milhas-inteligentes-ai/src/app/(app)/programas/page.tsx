import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";
import { KIND_LABEL } from "@/lib/labels";
import { diffDays, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Programas de Fidelidade" };

export default async function ProgramsPage() {
  const user = await requireUser();
  const accounts = await listAccounts(user.id, user.expiryAlertDays);
  const today = todayISO();
  return (
    <>
      <PageHeader
        title="Programas de Fidelidade"
        description="Saldo, validade, clube e valor do milheiro de cada programa. Nunca informe a senha dos programas."
        actions={
          <LinkButton href="/programas/novo">
            <Plus className="size-4" aria-hidden /> Adicionar programa
          </LinkButton>
        }
      />
      {accounts.length === 0 ? (
        <Card>
          <EmptyState
            icon={Wallet}
            title="Nenhum programa cadastrado"
            description="Adicione Livelo, Esfera, Smiles, LATAM Pass, Azul Fidelidade ou um programa personalizado."
            action={<LinkButton href="/programas/novo">Adicionar programa</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => {
            const days = a.nextExpiry ? diffDays(today, a.nextExpiry) : null;
            return (
              <Link key={a.id} href={`/programas/${a.id}`} className="group rounded-2xl focus-visible:outline-offset-4">
                <Card className="h-full p-5 transition-colors group-hover:border-line-strong">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted">{KIND_LABEL[a.kind]}</p>
                      <p className="text-base font-semibold">{a.programName}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <p className="mt-4 text-[26px] font-semibold leading-none tracking-tight tabular">
                    {formatPoints(a.balance)} <span className="text-sm font-normal text-muted">{a.unit}</span>
                  </p>
                  <p className="mt-2 text-xs text-ink-2">
                    {a.estimatedValueBrl != null ? `≈ ${formatBRL(a.estimatedValueBrl)} (milheiro a ${formatBRL(a.milheiroValueBrl!)})` : "Valor do milheiro não definido"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {a.clubName && <Badge tone="accent">{a.clubName}</Badge>}
                    {a.expiringSoon > 0 && (
                      <Badge tone={days != null && days <= 30 ? "critical" : "warning"}>
                        {formatPoints(a.expiringSoon)} vencem em {days} dias
                      </Badge>
                    )}
                    {a.expiredNotWrittenOff > 0 && <Badge tone="critical">{formatPoints(a.expiredNotWrittenOff)} vencidos</Badge>}
                    {!a.expiringSoon && a.nextExpiry && <Badge>Próxima validade {formatDate(a.nextExpiry)}</Badge>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
