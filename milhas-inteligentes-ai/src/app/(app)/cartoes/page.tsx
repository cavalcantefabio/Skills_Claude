import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listCards } from "@/server/services/cards";
import { listAccounts } from "@/server/services/accounts";
import { Badge, Card, EmptyState, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { CardCompare } from "@/components/card-compare";
import { BRAND_LABEL } from "@/lib/labels";
import { formatBRL, formatDecimal } from "@/lib/format";

export const metadata: Metadata = { title: "Meus Cartões" };

export default async function CardsPage() {
  const user = await requireUser();
  const [cards, accounts] = await Promise.all([listCards(user.id), listAccounts(user.id)]);
  const milheiroByProgram = new Map(accounts.map((a) => [a.programId, a.milheiroValueBrl]));

  return (
    <>
      <PageHeader
        title="Meus Cartões"
        description="Cartões de crédito, pontuação e anuidade. Não armazenamos número, CVV nem senha."
        actions={
          <LinkButton href="/cartoes/novo">
            <Plus className="size-4" aria-hidden /> Novo cartão
          </LinkButton>
        }
      />
      {cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={CreditCard}
            title="Nenhum cartão cadastrado"
            description="Cadastre seus cartões para comparar o retorno anual e atribuir os acúmulos de pontos."
            action={<LinkButton href="/cartoes/novo">Cadastrar cartão</LinkButton>}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <Card key={c.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">{c.issuer}</p>
                    <p className="truncate text-base font-semibold">{c.name}</p>
                  </div>
                  <Badge>{BRAND_LABEL[c.brand]}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Pontuação</dt>
                    <dd className="tabular">
                      {c.pointsPerUsd != null && `${formatDecimal(c.pointsPerUsd)} pts/US$`}
                      {c.pointsPerUsd != null && c.pointsPerBrl != null && " · "}
                      {c.pointsPerBrl != null && `${formatDecimal(c.pointsPerBrl)} pts/R$`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Anuidade</dt>
                    <dd className="tabular">{c.annualFeeBrl > 0 ? formatBRL(c.annualFeeBrl) : "Isenta"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Programa</dt>
                    <dd>{c.programName ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Vencimento</dt>
                    <dd>{c.dueDay ? `Dia ${c.dueDay}` : "—"}</dd>
                  </div>
                  {c.creditLimit != null && (
                    <div>
                      <dt className="text-xs text-muted">Limite</dt>
                      <dd className="tabular">{formatBRL(c.creditLimit)}</dd>
                    </div>
                  )}
                </dl>
                {c.benefits && <p className="mt-4 line-clamp-2 text-xs text-ink-2">{c.benefits}</p>}
                <div className="mt-auto pt-4">
                  <Link href={`/cartoes/${c.id}`} className={buttonClass("secondary", "sm")}>
                    <Pencil className="size-3.5" aria-hidden /> Ver e editar
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          <CardCompare
            usdRate={user.usdRateBrl}
            cards={cards.map((c) => ({
              id: c.id,
              label: `${c.issuer} ${c.name}`,
              programName: c.programName,
              annualFeeBrl: c.annualFeeBrl,
              pointsPerUsd: c.pointsPerUsd,
              pointsPerBrl: c.pointsPerBrl,
              milheiro: c.programId ? (milheiroByProgram.get(c.programId) ?? null) : null,
            }))}
          />
        </div>
      )}
    </>
  );
}
