import type { Metadata } from "next";
import Link from "next/link";
import { Plane } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { listCards } from "@/server/services/cards";
import { listTransactions } from "@/server/services/transactions";
import { createTransfer, createTx, deleteTx } from "@/server/actions/transactions";
import { TransferForm, TxForm } from "@/components/forms/tx-forms";
import { TxTable } from "@/components/tx-table";
import { Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { formatPoints } from "@/lib/format";
import { todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Minhas Milhas" };

export default async function MilesPage({ searchParams }: PageProps<"/milhas">) {
  const user = await requireUser();
  const sp = await searchParams;
  const accounts = await listAccounts(user.id, user.expiryAlertDays);
  const selected = typeof sp.programa === "string" && accounts.some((a) => a.id === sp.programa) ? sp.programa : undefined;
  const [cards, txs] = await Promise.all([listCards(user.id), listTransactions(user.id, { accountId: selected, limit: 200 })]);
  const today = todayISO();

  if (accounts.length === 0) {
    return (
      <>
        <PageHeader title="Minhas Milhas" />
        <Card>
          <EmptyState
            icon={Plane}
            title="Cadastre um programa primeiro"
            description="As movimentações ficam vinculadas a um programa de fidelidade."
            action={<LinkButton href="/programas/novo">Adicionar programa</LinkButton>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Minhas Milhas"
        description="Lance acúmulos, resgates e transferências. Cada crédito vira um lote com validade própria, e os débitos consomem primeiro os pontos que vencem antes."
      />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={selected === a.id ? "/milhas" : `/milhas?programa=${a.id}`}
            className={cx(
              "shrink-0 rounded-xl border px-3.5 py-2 text-left transition-colors",
              selected === a.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
            )}
            aria-pressed={selected === a.id}
          >
            <span className="block text-xs text-ink-2">{a.programName}</span>
            <span className="tabular text-sm font-semibold">
              {formatPoints(a.balance)} <span className="font-normal text-muted">{a.unit}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <TxForm
          action={createTx}
          today={today}
          defaultAccountId={selected}
          accounts={accounts}
          cards={cards.map((c) => ({ id: c.id, label: `${c.issuer} ${c.name}`, programId: c.programId }))}
        />
        {accounts.length > 1 ? (
          <TransferForm action={createTransfer} accounts={accounts} today={today} />
        ) : (
          <Card>
            <CardHeader title="Transferir entre programas" />
            <CardBody>
              <p className="text-sm text-muted">Cadastre ao menos dois programas para registrar transferências.</p>
            </CardBody>
          </Card>
        )}
      </div>
      <Card className="mt-4">
        <CardHeader
          title="Histórico de movimentações"
          description={
            selected
              ? `Filtrado por ${accounts.find((a) => a.id === selected)?.programName}. Clique no programa de novo para limpar o filtro.`
              : "Todos os programas, mais recentes primeiro. Só créditos ainda não usados podem ser excluídos; corrija o restante com ajustes."
          }
        />
        <CardBody>
          {txs.length ? <TxTable rows={txs} onDelete={deleteTx} /> : <p className="py-6 text-center text-sm text-muted">Nenhuma movimentação.</p>}
        </CardBody>
      </Card>
    </>
  );
}
