import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { listSelectablePrograms } from "@/server/services/accounts";
import { saveCard } from "@/server/actions/cards";
import { CardForm } from "@/components/forms/card-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Novo cartão" };

export default async function NewCardPage() {
  const user = await requireUser();
  const programs = await listSelectablePrograms(user.id);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo cartão" description="Os dados ficam visíveis só para você." />
      <CardForm action={saveCard.bind(null, null)} programs={programs} />
    </div>
  );
}
