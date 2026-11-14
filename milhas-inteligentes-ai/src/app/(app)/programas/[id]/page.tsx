import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { listAccounts, listLots } from "@/server/services/accounts";
import { listTransactions } from "@/server/services/transactions";
import { deleteAccount, updateAccount } from "@/server/actions/accounts";
import { deleteTx } from "@/server/actions/transactions";
import { AskAgent } from "@/components/agent/ask-agent";
import { WriteOffButton } from "@/components/forms/write-off-button";
import { EditAccountForm } from "@/components/forms/account-form";
import { DeleteButton } from "@/components/forms/submit";
import { TxTable } from "@/components/tx-table";
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, StatTile, Table, td, th } from "@/components/ui";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";
import { diffDays, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Programa" };

export default async function AccountPage({ params }: PageProps<"/programas/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const account = (await listAccounts(user.id, user.expiryAlertDays)).find((a) => a.id === id);
  if (!account) notFound();
  const [lots, txs] = await Promise.all([
    listLots(user.id).then((l) => l.filter((x) => x.accountId === id)),
    listTransactions(user.id, { accountId: id, limit: 100 }),
  ]);
  const today = todayISO();
  const clubYear =
    account.clubMonthlyCostBrl != null ? account.clubMonthlyCostBrl * 12 : null;

  return (
    <>
      <PageHeader
        title={account.programName}
        description={`Saldo em ${account.unit}, lotes por validade e histórico de movimentações.`}
        actions={
          <>
            <AskAgent
              size="md"
              question={`Analise meu programa ${account.programName}: saldo, validades, clube e valor do milheiro. O que você sugere fazer com esses ${account.unit}?`}
            />
            <LinkButton href={`/milhas?programa=${account.id}#lancar`} variant="secondary">
              <Plus className="size-4" aria-hidden /> Lançar movimentação
            </LinkButton>
            <DeleteButton
              action={deleteAccount}
              id={account.id}
              label="Remover programa"
              confirmText={`Remover ${account.programName}? Todo o histórico e os saldos deste programa serão apagados. Esta ação não pode ser desfeita.`}
            />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Saldo disponível"
          value={`${formatPoints(account.balance)}`}
          sub={account.expiredNotWrittenOff > 0 ? `${account.unit} · sem ${formatPoints(account.expiredNotWrittenOff)} vencidos` : account.unit}
        />
        <StatTile
          label="Valor estimado"
          value={account.estimatedValueBrl != null ? formatBRL(account.estimatedValueBrl) : "—"}
          sub={account.milheiroValueBrl != null ? `Milheiro a ${formatBRL(account.milheiroValueBrl)}` : "Defina o valor do milheiro abaixo"}
        />
        <StatTile
          label={`Vencendo em ${user.expiryAlertDays} dias`}
          value={formatPoints(account.expiringSoon)}
          sub={account.nextExpiry ? `Próxima validade ${formatDate(account.nextExpiry)}` : "Sem validade cadastrada"}
        />
        <StatTile
          label="Clube"
          value={account.clubName ?? "Não assina"}
          sub={clubYear != null ? `${formatBRL(account.clubMonthlyCostBrl!)}/mês · ${formatBRL(clubYear)}/ano` : undefined}
        />
      </div>

      {account.expiredNotWrittenOff > 0 && (
        <Card className="mt-4 border-critical/30">
          <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium text-ink">
                {formatPoints(account.expiredNotWrittenOff)} {account.unit} já venceram e não entram no saldo disponível.
              </p>
              <p className="mt-0.5 text-ink-2">
                Se o programa já baixou esses pontos, registre a expiração para o histórico ficar igual ao extrato. Se a validade foi cadastrada
                errada, corrija com um lançamento de ajuste.
              </p>
            </div>
            <WriteOffButton accountId={account.id} points={account.expiredNotWrittenOff} unit={account.unit} />
          </div>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardHeader title="Saldo por validade" description="Débitos consomem primeiro os pontos que vencem antes." />
          <CardBody>
            {lots.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Nenhum ponto disponível.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th className={th}>Validade</th>
                    <th className={`${th} text-right`}>Disponível</th>
                    <th className={`${th} text-right`}>Creditado</th>
                    <th className={th}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((l) => {
                    const d = l.expiresAt ? diffDays(today, l.expiresAt) : null;
                    return (
                      <tr key={l.id}>
                        <td className={`${td} tabular`}>{l.expiresAt ? formatDate(l.expiresAt) : "Sem validade"}</td>
                        <td className={`${td} tabular text-right font-medium`}>{formatPoints(l.remaining)}</td>
                        <td className={`${td} tabular text-right text-ink-2`}>{formatPoints(l.original)}</td>
                        <td className={td}>
                          {d == null ? (
                            "—"
                          ) : d < 0 ? (
                            <Badge tone="critical">Vencido: lance a expiração</Badge>
                          ) : d <= user.expiryAlertDays ? (
                            <Badge tone={d <= 30 ? "critical" : "warning"}>Vence em {d} dias</Badge>
                          ) : (
                            <span className="text-xs text-muted">em {d} dias</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
        <EditAccountForm action={updateAccount.bind(null, account.id)} initial={account} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Histórico de movimentações" description="Últimas 100 movimentações deste programa." />
        <CardBody>
          {txs.length ? (
            <TxTable rows={txs} showProgram={false} onDelete={deleteTx} />
          ) : (
            <p className="py-6 text-center text-sm text-muted">Nenhuma movimentação.</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}
