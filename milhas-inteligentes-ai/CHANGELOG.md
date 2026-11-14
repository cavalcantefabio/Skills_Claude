# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [0.6.0] - 2026-11-14 (Etapa 3, entrega 1)

### Adicionado
- Radar de Oportunidades: o Claude pesquisa na web (domínios restritos a sites oficiais e blogs de
  milhas) e registra promoções vigentes com fonte, datas, bônus e condições; promoções vencidas ou
  com link fora de http(s) são descartadas.
- Cálculo para os saldos da pessoa (milhas recebidas, custo efetivo do milheiro e comparação com o
  valor de referência) e alertas das promoções relevantes.
- Tabelas `radar_runs` e `radar_opportunities`; `agent_usage` ganhou `source` e `web_searches`.
- Buscas na web entram no custo (US$ 0,01 cada). Limite diário `RADAR_DAILY_LIMIT` (padrão 3).

### Alterado
- O Radar usa o Claude Sonnet 5.5 (o agente de conversa segue no Opus 5.5).

### Verificado
- Atualização real com o Opus 5.5: 4 promoções em 46 s, 8 buscas, US$ 0,71.
- Atualização real com o Sonnet 5.5: 5 promoções em 42 s, 8 buscas, US$ 0,34.

## [0.5.0] - 2026-11-14

### Adicionado
- Botão "Perguntar ao agente" em cada alerta, em cada viagem, na página de cada programa e em Meus
  Cartões. Abre o agente com uma pergunta escrita a partir daquele contexto; a pessoa revisa e envia
  (nada é enviado sozinho). Os botões somem se o agente não estiver configurado.

## [0.4.0] - 2026-11-14

### Adicionado
- Custo do agente na tela: por conversa, no mês, desde o início, e mensagens usadas no dia.
- Tabela `agent_usage` com tokens e custo estimado por resposta (o total do mês não muda ao excluir
  conversas). A migração 0005 importa o uso das conversas anteriores.
- `src/lib/pricing.ts`: tabela de preços por modelo (inclui modelos de fallback) e cálculo do custo
  com leitura e escrita de cache.

## [0.3.1] - 2026-11-14

### Adicionado
- Publicação alternativa no Render + Neon: `scripts/render-build.sh` (pnpm via npx, migrações e
  build) e guia `RENDER.md`.
- Node 22 fixado (`engines` no `package.json` e `.node-version`).

## [0.3.0] - 2026-11-13

### Adicionado
- Publicação para uso pessoal na Vercel + Neon, com guia em `DEPLOY.md` e migrações automáticas
  antes de cada build (`vercel.json`).
- Cadastro fechado automaticamente depois da primeira conta (`ALLOW_SIGNUP=true` reabre).
- `DATABASE_POOL_MAX` para limitar conexões em hospedagem serverless.

## [0.2.1] - 2026-11-13

### Corrigido
- A chave do agente é lida de `MILHAS_ANTHROPIC_API_KEY` (em sessões do Claude Code,
  `ANTHROPIC_API_KEY` é reservado) e o endereço da API é fixo, sem herdar `ANTHROPIC_BASE_URL`.
- O agente recebe a cotação do dólar cadastrada no perfil; antes, em contas de cartões,
  ele supunha uma cotação.

### Verificado
- Teste com a API real em 5 cenários: respostas corretas conferidas contra o banco,
  proposta só gravada após confirmação e ~US$ 0,05 por mensagem com cache do prompt ativo.

## [0.2.0] - 2026-11-13 (Etapa 2, entrega 1)

### Adicionado
- Agente Inteligente (Claude Opus 5.5 via `@anthropic-ai/sdk`) com respostas em streaming,
  conversas salvas e lista de conversas.
- 7 ferramentas de leitura e 3 de proposta; propostas viram cartões "Confirmar/Recusar"
  e só gravam após confirmação, revalidadas e executadas pelos serviços existentes.
- Tabelas `agent_conversations`, `agent_messages` e `agent_actions` (migrações 0002 e 0003).
- Rota `POST /api/agente` com SSE, checagem de origem e limite diário por usuário.
- Variáveis `ANTHROPIC_API_KEY` e `AGENT_DAILY_MESSAGE_LIMIT`.

### Alterado
- `transferPoints` aceita uma transação externa.
- Rotas `/api/*` sem sessão respondem 401 em JSON (antes redirecionavam).

### Testes
- 14 testes novos (ferramentas, propostas, confirmação e o loop com cliente simulado da API):
  51 no total.

## [0.1.0] - 2026-11-13 (Etapa 1)

### Entrega 1: Estrutura, banco, autenticação e dashboard
- App Next.js 16 + React 19 + TypeScript + Tailwind 4.
- PostgreSQL com Drizzle: usuários, perfis, sessões, programas, contas de fidelidade,
  saldos por lote, cartões, transações, simulações e viagens; `CHECK`s de integridade.
- Migração `0001` com catálogo de 12 programas (Livelo, Esfera, Átomos, Inter Loop,
  Smiles, LATAM Pass, Azul Fidelidade, TAP Miles&Go, Flying Blue, AAdvantage, Iberia, ALL Accor).
- Serviço de lançamentos com consumo FIFO por validade e transferências atômicas.
- Cadastro e login por e-mail/senha, sessões no banco, rate limit, cabeçalhos de segurança.
- Layout com menu lateral (gaveta no celular), modo claro/escuro/sistema.
- Dashboard: KPIs, saldo por programa, vencimentos, acumulado no mês e 5 gráficos com
  visão em tabela, filtros de período e programa.
- Script de dados de demonstração.

### Entrega 2: Cartões, programas e movimentações
- Cartões: CRUD, limite cifrado (AES-256-GCM) e comparação de retorno anual.
- Programas: cadastro com saldo e validade, programa personalizado, clube, valor do
  milheiro, lotes por validade e histórico.
- Minhas Milhas: lançamentos de todos os tipos e transferências com paridade e bônus.
- Formulários mantêm o que foi digitado quando há erro de validação.

### Entrega 3: Calculadoras e módulos restantes
- 6 calculadoras com validação, explicação passo a passo, veredito e simulações salvas
  (recalculadas no servidor).
- Planejador de viagens com progresso do saldo e valor obtido por milheiro.
- Alertas de vencimento, pontos vencidos, clubes deficitários, viagens e cadastros incompletos.
- Configurações: perfil, cotação do dólar, janela de alertas, tema, senha e sessões.
- Radar e Agente marcados como "Em desenvolvimento".
- Leitura de números em formato brasileiro (`50.000`, `1.234,56`).

### Testes
- 37 testes vitest (datas, séries, formatação, calculadoras e ledger contra Postgres).
- Teste ponta a ponta com 28 verificações no navegador.
