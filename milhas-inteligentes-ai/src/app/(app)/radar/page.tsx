import type { Metadata } from "next";
import { InDevelopment, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Radar de Oportunidades" };

export default function RadarPage() {
  return (
    <>
      <PageHeader
        title="Radar de Oportunidades"
        description="Monitoramento automático de promoções de transferência, compra de pontos e passagens com milhas."
      />
      <InDevelopment
        title="Radar automatizado"
        planned={[
          "Monitorar transferências bonificadas (Livelo, Esfera → companhias aéreas)",
          "Acompanhar promoções de compra de pontos e milhas",
          "Buscar disponibilidade de passagens com milhas nas rotas que você acompanha",
          "Comparar o custo da oportunidade com o valor do milheiro dos seus programas",
          "Registrar data e fonte de cada oportunidade encontrada",
          "Enviar as oportunidades relevantes para Alertas",
        ]}
      />
    </>
  );
}
