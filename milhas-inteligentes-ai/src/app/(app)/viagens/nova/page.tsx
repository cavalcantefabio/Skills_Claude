import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { listSelectablePrograms } from "@/server/services/accounts";
import { saveTrip } from "@/server/actions/trips";
import { TripForm } from "@/components/forms/trip-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Nova viagem" };

export default async function NewTripPage() {
  const user = await requireUser();
  const programs = await listSelectablePrograms(user.id);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nova viagem" />
      <TripForm action={saveTrip.bind(null, null)} programs={programs.filter((p) => p.kind === "aerea" || p.custom)} />
    </div>
  );
}
