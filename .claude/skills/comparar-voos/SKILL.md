---
name: comparar-voos
description: Busca voos em várias fontes em paralelo e entrega um ranking com preço, duração, escalas e bagagem. Use para "voos de X para Y", "passagem mais barata", "comparar companhias" ou quando o planejamento precisar de voos.
---

# Comparar Voos

## Fontes (em paralelo)

| Fonte | Como | Chave | Observação |
|-------|------|-------|------------|
| Kiwi.com | MCP `kiwi` | Não | Combina companhias diferentes; ruim em mercados pequenos |
| Skiplagged | MCP `skiplagged` | Não | Mostra "hidden city"; avise dos riscos antes de sugerir |
| Duffel | API REST | `DUFFEL_API_KEY` | Preços reais por classe tarifária; o mais confiável |
| Google Flights | SerpAPI | `SERPAPI_API_KEY` | Bom para descobrir datas; preço costuma vir inflado |
| Sites das companhias | Navegador | — | Fonte final (GOL, LATAM, Azul, TAP etc.) |

Se uma fonte falhar por falta de chave, siga com as outras sem perguntar.

## Passos

1. Normalize os aeroportos (código IATA). Considere aeroportos alternativos: GRU/CGH/VCP em São Paulo; GIG/SDU no Rio; e o mesmo no destino.
2. Busque ida e volta e, se fizer sentido, dois trechos só de ida (às vezes sai mais barato).
3. Se as datas forem flexíveis, compare ±3 dias.
4. Elimine duplicadas e opções absurdas (escala > 12 h, aeroporto trocado na conexão sem aviso).
5. Converta tudo para R$ e informe o que a tarifa **inclui** (bagagem despachada, marcação de assento).

## Saída

| # | Companhia | Ida | Volta | Duração | Escalas | Bagagem | Preço total (R$) | Fonte |
|---|-----------|-----|-------|---------|---------|---------|------------------|-------|

Depois da tabela: mais barata, mais rápida e **melhor custo-benefício**, com o porquê ("R$ 180 mais cara, mas economiza 6 h e inclui mala").

## Cuidados

- **Hidden city / skiplagging**: só bagagem de mão, não funciona em trecho de ida-e-volta no mesmo bilhete, e a companhia pode penalizar. Sempre avise.
- Conexões com troca de aeroporto (ex.: CDG→ORY) precisam de alerta.
- Bilhetes separados não garantem a conexão: avise o risco e sugira margem de tempo.
