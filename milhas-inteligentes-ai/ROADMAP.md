# Roadmap: Milhas Inteligentes AI

## Etapa 1: Base funcional ✅ (aguardando aprovação)

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

## Etapa 2: Agente de inteligência artificial 🚧

- Agente conversacional com acesso, pelos serviços do servidor, a saldos, cartões e viagens.
- Calculadoras expostas como ferramentas do agente (já são funções puras).
- Toda ação que mova pontos ou dinheiro exige confirmação explícita.
- Avaliar o serviço Python (FastAPI) apenas se as bibliotecas necessárias exigirem.

## Etapa 3: Radar automatizado de oportunidades 🚧

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
