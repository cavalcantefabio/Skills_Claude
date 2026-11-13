import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, MessageSquarePlus, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { requireUser } from "@/server/auth/session";
import { agentEnabled } from "@/server/agent/client";
import { listConversations, loadConversationView } from "@/server/agent/view";
import { deleteConversation } from "@/server/actions/agent";
import { AgentChat } from "@/components/agent/chat";
import { DeleteButton } from "@/components/forms/submit";
import { Card, CardBody, CardHeader, LinkButton, PageHeader, cx } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Agente Inteligente" };

export default async function AgentPage({ searchParams }: PageProps<"/agente">) {
  const user = await requireUser();
  const sp = await searchParams;

  if (!agentEnabled()) {
    return (
      <>
        <PageHeader title="Agente Inteligente" description="Assistente de IA que usa seus saldos, cartões e viagens para responder e fazer as contas." />
        <Card>
          <div className="flex items-start gap-4 p-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning-ink">
              <KeyRound className="size-5" aria-hidden />
            </span>
            <div className="text-sm text-ink-2">
              <h2 className="text-[15px] font-semibold text-ink">Agente não configurado</h2>
              <p className="mt-1">
                O agente usa a API do Claude. Para ativá-lo, defina a variável de ambiente <code className="rounded bg-surface-2 px-1">MILHAS_ANTHROPIC_API_KEY</code> no
                servidor e reinicie o app. A chave fica só no servidor e nunca é enviada ao navegador.
              </p>
            </div>
          </div>
        </Card>
      </>
    );
  }

  const selected = typeof sp.c === "string" && z.string().uuid().safeParse(sp.c).success ? sp.c : null;
  const [conversations, view] = await Promise.all([
    listConversations(user.id),
    selected ? loadConversationView(user.id, selected) : Promise.resolve(null),
  ]);
  if (selected && !view) notFound();

  return (
    <>
      <PageHeader
        title="Agente Inteligente"
        description="Pergunte sobre seus pontos, cartões e viagens. O agente só lê seus dados; para registrar algo, ele propõe e você confirma."
        actions={
          <LinkButton href="/agente" variant="secondary">
            <MessageSquarePlus className="size-4" aria-hidden /> Nova conversa
          </LinkButton>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="order-2 flex flex-col gap-4 xl:order-1">
          <Card>
            <CardHeader title="Conversas" />
            <CardBody className="px-2 pt-2 sm:px-2">
              {conversations.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">Nenhuma conversa ainda.</p>
              ) : (
                <ul className="flex max-h-[420px] flex-col gap-0.5 overflow-y-auto">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/agente?c=${c.id}`}
                        aria-current={c.id === selected ? "page" : undefined}
                        className={cx(
                          "block rounded-lg px-3 py-2 transition-colors",
                          c.id === selected ? "bg-surface-3" : "hover:bg-surface-2",
                        )}
                      >
                        <span className="block truncate text-[13px] font-medium text-ink">{c.title}</span>
                        <span className="text-[11px] text-muted">{formatDate(c.updatedAt.toISOString())}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {view && (
            <DeleteButton action={deleteConversation} id={view.conversation.id} label="Excluir conversa" confirmText="Excluir esta conversa? As propostas pendentes também serão descartadas." />
          )}
          <div className="flex gap-2 px-1 text-xs text-muted">
            <ShieldCheck className="size-4 shrink-0 text-good-ink" aria-hidden />
            <p>O agente não acessa senhas, número de cartão nem limite de crédito, e nunca grava nada sem a sua confirmação.</p>
          </div>
        </aside>
        <section className="order-1 min-w-0 xl:order-2" aria-label="Conversa">
          <AgentChat
            key={view?.conversation.id ?? "nova"}
            conversationId={view?.conversation.id ?? null}
            initialItems={view?.items ?? []}
            initialActions={view?.actions ?? []}
          />
        </section>
      </div>
    </>
  );
}
