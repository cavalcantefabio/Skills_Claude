import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { loadTripPlans } from "@/server/services/trip-plan";
import { deleteTrip, saveTrip } from "@/server/actions/trips";
import { TripForm } from "@/components/forms/trip-form";
import { DeleteButton } from "@/components/forms/submit";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Editar viagem" };

export default async function EditTripPage({ params }: PageProps<"/viagens/[id]/editar">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [[row], accounts] = await Promise.all([loadTripPlans(user.id, id), listAccounts(user.id)]);
  if (!row) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Editar: ${row.trip.title}`}
        actions={<DeleteButton action={deleteTrip} id={row.trip.id} confirmText="Excluir esta viagem e todas as cotações dela?" />}
      />
      <TripForm
        action={saveTrip.bind(null, row.trip.id)}
        accounts={accounts}
        consideredAccountIds={row.consideredAccountIds}
        initial={row.trip}
        cancelHref={`/viagens/${row.trip.id}`}
      />
    </div>
  );
}
