import type { Metadata } from "next";
import { requireUser } from "@/server/auth/session";
import { listAccounts, listSelectablePrograms } from "@/server/services/accounts";
import { createAccount } from "@/server/actions/accounts";
import { NewAccountForm } from "@/components/forms/account-form";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Adicionar programa" };

export default async function NewAccountPage() {
  const user = await requireUser();
  const [programs, accounts] = await Promise.all([listSelectablePrograms(user.id), listAccounts(user.id)]);
  const taken = new Set(accounts.map((a) => a.programId));
  return (
    <div className="max-w-3xl">
      <PageHeader title="Adicionar programa" description="Informe o saldo atual. Movimentações futuras são lançadas em Minhas Milhas." />
      <NewAccountForm action={createAccount} programs={programs.filter((p) => !taken.has(p.id))} />
    </div>
  );
}
