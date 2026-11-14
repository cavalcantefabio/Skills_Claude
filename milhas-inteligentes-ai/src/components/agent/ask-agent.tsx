import Link from "next/link";
import { Bot } from "lucide-react";
import { agentEnabled } from "@/server/agent/client";
import { buttonClass, cx } from "@/components/ui";
import { askAgentHref } from "@/lib/ask-agent";

/**
 * Botão "Perguntar ao agente": abre o agente com a pergunta já escrita, para a pessoa
 * revisar e enviar. Não aparece se o agente não estiver configurado.
 */
export function AskAgent({
  question,
  label = "Perguntar ao agente",
  size = "sm",
  variant = "secondary",
  className,
}: {
  question: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  className?: string;
}) {
  if (!agentEnabled()) return null;
  return (
    <Link href={askAgentHref(question)} className={cx(buttonClass(variant, size), className)} title={question}>
      <Bot className="size-3.5" aria-hidden /> {label}
    </Link>
  );
}
