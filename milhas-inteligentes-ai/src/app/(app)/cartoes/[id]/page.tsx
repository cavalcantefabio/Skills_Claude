import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { listSelectablePrograms } from "@/server/services/accounts";
import { listCards } from "@/server/services/cards";
import { deleteCard, saveCard } from "@/server/actions/cards";
import { CardForm } from "@/components/forms/card-form";
import { DeleteButton } from "@/components/forms/submit";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Editar cartão" };

export default async function EditCardPage({ params }: PageProps<"/cartoes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [[card], programs] = await Promise.all([listCards(user.id, id), listSelectablePrograms(user.id)]);
  if (!card) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`${card.issuer} ${card.name}`}
        description="Edite os dados do cartão."
        actions={
          <DeleteButton
            action={deleteCard}
            id={card.id}
            confirmText="Excluir este cartão? Os acúmulos já registrados continuam no histórico, sem vínculo com o cartão."
          />
        }
      />
      <CardForm action={saveCard.bind(null, card.id)} programs={programs} initial={card} />
    </div>
  );
}
