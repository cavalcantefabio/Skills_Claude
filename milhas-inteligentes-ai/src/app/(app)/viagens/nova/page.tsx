import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { listAccounts } from "@/server/services/accounts";
import { saveTrip } from "@/server/actions/trips";
import { TripForm } from "@/components/forms/trip-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Nova viagem" };

export default async function NewTripPage() {
  const user = await requireUser();
  const accounts = await listAccounts(user.id);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nova viagem" description="Depois de salvar, registre as cotações em milhas e em dinheiro para montar o plano." />
      <TripForm action={saveTrip.bind(null, null)} accounts={accounts} />
    </div>
  );
}
