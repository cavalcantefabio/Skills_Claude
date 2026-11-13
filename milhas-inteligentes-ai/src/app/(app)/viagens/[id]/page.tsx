import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { listSelectablePrograms } from "@/server/services/accounts";
import { listTrips } from "@/server/services/trips";
import { deleteTrip, saveTrip } from "@/server/actions/trips";
import { TripForm } from "@/components/forms/trip-form";
import { DeleteButton } from "@/components/forms/submit";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Editar viagem" };

export default async function EditTripPage({ params }: PageProps<"/viagens/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [[row], programs] = await Promise.all([listTrips(user.id, id), listSelectablePrograms(user.id)]);
  if (!row) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={row.trip.title}
        actions={<DeleteButton action={deleteTrip} id={row.trip.id} confirmText="Excluir esta viagem?" />}
      />
      <TripForm
        action={saveTrip.bind(null, row.trip.id)}
        programs={programs.filter((p) => p.kind === "aerea" || p.custom || p.id === row.trip.programId)}
        initial={row.trip}
      />
    </div>
  );
}
