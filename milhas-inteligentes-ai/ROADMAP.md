# Roadmap: Milhas Inteligentes AI

## Etapa 1: Base funcional ✅ (aprovada)

- [x] Estrutura Next.js + PostgreSQL + Drizzle com migrações
- [x] Autenticação e autorização por usuário
- [x] Dashboard com indicadores, gráficos e filtros
- [x] Cartões: CRUD e comparação
- [x] Programas de fidelidade: catálogo, personalizados, clube, valor do milheiro
- [x] Movimentações com lotes por validade (FIFO) e transferências
- [x] 6 calculadoras com explicação e simulações salvas
- [x] Planejador de viagens (cadastro e progresso)
- [x] Alertas calculados a partir dos dados
- [x] Configurações, modo claro/escuro, layout responsivo
- [x] Testes unitários, de integração e ponta a ponta

### Pendências conhecidas da Etapa 1

- Recuperação de senha por e-mail (precisa de provedor de e-mail).
- Troca de e-mail e exclusão de conta pela interface.
- Rate limit de login em memória: trocar por Redis/Postgres se houver mais de uma instância.
- Importação de extratos (CSV) dos programas.
- Edição de movimentações (hoje: excluir crédito intacto ou lançar ajuste).
- Ajuste automático de pontos vencidos (hoje o alerta pede o lançamento de expiração).
- Testes e2e rodando em CI (o script existe; falta o pipeline).
- Atualização de dependências marcadas como obsoletas pelo scaffold (eslint 9).

## Etapa 2: Agente de inteligência artificial 🟡 (entrega 1 concluída)

- [x] Agente conversacional com streaming e conversas salvas
- [x] Ferramentas de leitura: programas, vencimentos, movimentações, cartões, viagens, alertas
- [x] Calculadoras como ferramenta
- [x] Propostas de lançamento, transferência e viagem com confirmação na tela
- [x] Limite diário de mensagens, proteção CSRF, isolamento por usuário
- [x] Teste com a API real: 5 cenários (vencimentos, cartões, dinheiro x milhas, proposta confirmada, pergunta sem dados de mercado); custo medido de ~US$ 0,05 por mensagem
- [ ] Avaliação de qualidade das respostas (conjunto de perguntas de referência)
- [x] Custo estimado por conversa, do mês e desde o início, e mensagens do dia (tabela `agent_usage`)
- [x] Botão "Perguntar ao agente" em alertas, viagens, cartões e na página de cada programa (pergunta preparada, enviada só pela pessoa)
- FastAPI segue desnecessário.

## Etapa 3: Radar de oportunidades 🟡 (entrega 1 concluída)

- [x] Botão "Atualizar radar": Claude com busca na web (sites oficiais + blogs de milhas) registra
      promoções vigentes de transferência bonificada e compra de pontos, sempre com fonte e datas
- [x] Cálculo do efeito nos saldos e comparação com o valor do milheiro; alertas das promoções relevantes
- [x] Custo por atualização no painel de uso; limite diário (`RADAR_DAILY_LIMIT`)
- [x] Custo reduzido de ~US$ 0,71 para ~US$ 0,34 por atualização com o Claude Sonnet 5.5 no Radar
- [ ] Atualização automática agendada (decidido começar manual)
- [ ] Passagens com milhas: sem API pública para Smiles, LATAM Pass e Azul

### Planejado antes (referência)

- Coleta de promoções de transferência bonificada e compra de pontos, com fonte e data.
- Busca de disponibilidade de passagens com milhas (skills `award-travel`/`flight-search`
  são candidatas: exigem conta e servidores MCP de terceiros).
- Notificações (e-mail/push) a partir dos alertas.

## Etapa 4: Recomendações personalizadas 🚧

- Sugestão de cartão, programa e estratégia de transferência pelo perfil de gasto.
- Plano de acúmulo para cada viagem planejada.

## Etapa 5: Evolução contínua 🚧

- Registro do resultado das recomendações e ajuste dos critérios.
- Métricas de uso e de economia real.
