import type { Metadata } from "next";
import { InDevelopment, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Agente Inteligente" };

export default function AgentPage() {
  return (
    <>
      <PageHeader
        title="Agente Inteligente"
        description="Assistente de IA que vai usar seus saldos, cartões e viagens para responder perguntas e sugerir estratégias."
      />
      <InDevelopment
        title="Agente de inteligência artificial"
        planned={[
          "Conversa em linguagem natural sobre seus programas e saldos",
          "Sugestões de emissão comparando dinheiro e milhas",
          "Plano para atingir as milhas de uma viagem planejada",
          "Explicação do raciocínio e das fontes de cada recomendação",
          "Uso das mesmas calculadoras deste app, com resultados auditáveis",
          "Nenhuma ação (transferência, compra, emissão) sem sua confirmação",
        ]}
      />
    </>
  );
}
