import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Map as MapIcon, Pencil, Plus } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listTrips } from "@/server/services/trips";
import { listAccounts } from "@/server/services/accounts";
import { Badge, Card, EmptyState, InDevelopment, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { dinheiroVsMilhas } from "@/lib/calculators";
import { formatBRL, formatDate, formatPoints } from "@/lib/format";
import { CABIN_LABEL, TRIP_STATUS_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Planejador de Viagens" };

export default async function TripsPage() {
  const user = await requireUser();
  const [trips, accounts] = await Promise.all([listTrips(user.id), listAccounts(user.id)]);
  const byProgram = new Map(accounts.map((a) => [a.programId, a]));

  return (
    <>
      <PageHeader
        title="Planejador de Viagens"
        description="Registre as viagens que você quer fazer e acompanhe se seu saldo cobre as milhas necessárias."
        actions={
          <LinkButton href="/viagens/nova">
            <Plus className="size-4" aria-hidden /> Nova viagem
          </LinkButton>
        }
      />
      {trips.length === 0 ? (
        <Card>
          <EmptyState
            icon={MapIcon}
            title="Nenhuma viagem planejada"
            description="Cadastre destino, datas e a cotação em milhas para acompanhar seu progresso."
            action={<LinkButton href="/viagens/nova">Planejar viagem</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {trips.map(({ trip, programName }) => {
            const acc = trip.programId ? byProgram.get(trip.programId) : undefined;
            const pct = acc && trip.milesNeeded ? Math.min(acc.balance / trip.milesNeeded, 1) : null;
            const missing = acc && trip.milesNeeded ? Math.max(trip.milesNeeded - acc.balance, 0) : null;
            const cmp =
              trip.milesNeeded && trip.cashPriceBrl && acc?.milheiroValueBrl
                ? dinheiroVsMilhas({ precoDinheiro: Number(trip.cashPriceBrl), milhas: trip.milesNeeded, taxas: 0, custoMilheiro: acc.milheiroValueBrl })
                : null;
            return (
              <Card key={trip.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{trip.title}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                      {trip.origin} <ArrowRight className="size-3.5" aria-hidden /> {trip.destination}
                    </p>
                  </div>
                  <Badge tone={trip.status === "emitida" ? "good" : trip.status === "cancelada" ? "critical" : "accent"}>
                    {TRIP_STATUS_LABEL[trip.status]}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {trip.departDate ? formatDate(trip.departDate) : "Data a definir"}
                  {trip.returnDate && ` – ${formatDate(trip.returnDate)}`} · {trip.passengers} passageiro(s) · {CABIN_LABEL[trip.cabin]}
                  {trip.flexibleDates && " · datas flexíveis"}
                </p>
                {pct != null && acc && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-ink-2">
                        {formatPoints(acc.balance)} de {formatPoints(trip.milesNeeded!)} {acc.unit} em {programName}
                      </span>
                      <span className="tabular font-medium">{Math.round(pct * 100)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2">
                      <div className="h-2 rounded-full bg-[var(--series-3)]" style={{ width: `${Math.max(pct * 100, 1.5)}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {missing ? `Faltam ${formatPoints(missing)} ${acc.unit}.` : "Seu saldo já cobre as milhas necessárias."}
                    </p>
                  </div>
                )}
                {trip.programId && !acc && (
                  <p className="mt-4 text-xs text-muted">Você ainda não cadastrou {programName} em Programas de Fidelidade.</p>
                )}
                {cmp && (
                  <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
                    Cada milheiro vale {formatBRL(cmp.raw.valorObtido)} nesta emissão (sem contar taxas), contra {formatBRL(acc!.milheiroValueBrl!)} do seu valor de referência.
                  </p>
                )}
                <div className="mt-auto pt-4">
                  <Link href={`/viagens/${trip.id}`} className={buttonClass("secondary", "sm")}>
                    <Pencil className="size-3.5" aria-hidden /> Editar
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <div className="mt-6">
        <InDevelopment
          title="Busca e sugestões automáticas"
          planned={[
            "Buscar disponibilidade de passagens com milhas e preços em dinheiro",
            "Sugerir o programa e a rota que exigem menos milhas",
            "Comparar datas próximas quando as datas forem flexíveis",
            "Montar um plano de acúmulo e transferências para a viagem",
          ]}
        />
      </div>
    </>
  );
}
