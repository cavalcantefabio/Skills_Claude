---
name: milhas-e-pontos
description: Programas de fidelidade brasileiros e internacionais, transferência de pontos de cartão (Livelo, Esfera etc.) para companhias (Smiles, LATAM Pass, Azul Fidelidade, TAP Miles&Go...) e cálculo do valor do milheiro. Use quando a pessoa mencionar milhas, pontos, cartão, emissão, transferência bonificada ou "vale a pena usar milhas?".
---

# Milhas e Pontos

Referência: `data/programas-fidelidade.json` (nesta pasta da skill). **Paridades e bônus mudam o tempo todo**: o arquivo é ponto de partida, não verdade. Confirme no site oficial antes de recomendar uma transferência e registre a data da verificação.

## Saldo efetivo

O saldo efetivo em um programa aérea = saldo direto **+** o que pode chegar via transferência dos programas de banco (Livelo, Esfera, etc.), ajustado pela paridade e por eventual bônus vigente. Nunca descarte um programa só porque o saldo direto é zero.

## Valor do milheiro

```
valor do milheiro (R$) = (preço em dinheiro − taxas pagas na emissão) ÷ (milhas usadas ÷ 1.000)
```

- Compare com o **custo de reposição**: quanto custa comprar ou gerar 1.000 milhas daquele programa hoje (ver `data/programas-fidelidade.json`, campo `milheiro_referencia_brl`, sempre com data).
- Se o valor obtido for maior que o custo de reposição → **emitir com milhas** compensa. Se for menor → pague em dinheiro e guarde as milhas.
- Inclua sempre as taxas de embarque e, em voos internacionais, eventuais sobretaxas cobradas na emissão.

## Fluxo

1. Pergunte (ou use o que já sabe) os saldos por programa.
2. Busque a emissão no site de cada programa relevante (Smiles, LATAM Pass, Azul Fidelidade, TAP Miles&Go, Flying Blue, etc.). Programas estrangeiros às vezes emitem voos de parceiras brasileiras ou de alianças por menos milhas.
3. Verifique se há **transferência bonificada** vigente (Livelo/Esfera → aérea). Um bônus muda a conta inteira.
4. Calcule o valor do milheiro de cada opção e monte a tabela.
5. **Só transfira depois de confirmar a disponibilidade da emissão**: transferências são irreversíveis.

## Saída

| Programa | Milhas | Taxas (R$) | Preço em dinheiro (R$) | Valor do milheiro (R$) | Caminho até as milhas | Recomendação |
|----------|--------|------------|------------------------|------------------------|-----------------------|--------------|

## Alertas

- Milhas vencem: avise quando o viajante citar saldo antigo.
- Clubes de assinatura (Clube Smiles, Clube LATAM Pass, Clube Azul) costumam liberar bônus maiores de transferência; considere na conta se o viajante já assina.
- Não recomende compra de milhas de terceiros fora dos canais oficiais.
