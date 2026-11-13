# CLAUDE.md: Milhas Inteligentes AI

Guia para agentes (Claude Code) que trabalham neste projeto. Leia antes de mudar código.

@AGENTS.md

## O que é

Plataforma web para gerenciar pontos, milhas, cartões de crédito e viagens.
**Etapa atual: 2 (Agente Inteligente), entrega 1 concluída.** Etapa 1 aprovada.
Radar, recomendações e evolução contínua são etapas seguintes e dependem de aprovação.

## Stack e decisões

| Camada | Escolha | Por quê |
|---|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript | Um único app full-stack: server components + server actions dispensam uma API separada. |
| Estilo | Tailwind CSS 4 com tokens em `src/app/globals.css` | Componentes usam papéis (`bg-surface`, `text-ink-2`), nunca hex. Modo escuro via classe `.dark` (next-themes). |
| Banco | PostgreSQL 16 + Drizzle ORM + drizzle-kit | JS puro (sem binários para baixar), migrações SQL versionadas em `drizzle/`. |
| Gráficos | Recharts 3 | Paleta validada pela skill `dataviz` (ver "Gráficos"). |
| Auth | E-mail/senha próprios: bcryptjs + sessão em tabela | Escopo de MVP, sem dependência externa. |
| Validação | zod 4 | Mesmos schemas no cliente (calculadoras) e no servidor. |
| Testes | vitest (unit + integração no Postgres) e Playwright (e2e) | |

Decisões registradas:
- **Sem FastAPI na Etapa 1.** Nada exigia Python. Se o agente de IA da Etapa 2 precisar
  de bibliotecas Python, ele entra como serviço separado consumindo a mesma base.
- **`cacheComponents: false`.** O scaffold do Next 16.4 liga Cache Components, que exige
  `<Suspense>`/`use cache: private` em toda leitura de sessão. Todas as páginas aqui são
  privadas e dinâmicas por usuário, então usamos renderização dinâmica simples.
- **`proxy.ts`** (antigo `middleware.ts` no Next 16) só faz a checagem otimista do cookie.
  A autorização real é `requireUser()` em **toda** página e server action.

## Estrutura

```
src/
  app/(auth)/         login e cadastro (redireciona para / se já logado)
  app/(app)/          páginas autenticadas; layout chama requireUser()
  components/         ui.tsx (primitivas), charts/, forms/, layout/
  lib/                código puro, sem I/O: calculators/, dates, format, series, validation
  server/
    db/schema.ts      esquema Drizzle (fonte da verdade do banco)
    auth/             sessão, senha, rate limit, actions de login
    actions/          server actions ("use server"): só funções async exportadas
    services/         regras de negócio e consultas (ledger, accounts, dashboard, alerts...)
drizzle/              migrações SQL geradas + 0001 com o catálogo de programas
scripts/              migrate.ts, seed-demo.ts
tests/                unit/, integration/, e2e/smoke.mjs
```

## Regras de domínio (não quebre)

1. **Nunca some pontos de programas diferentes.** São unidades distintas. O único
   consolidado entre programas é o **valor estimado em R$** (`saldo/1000 × milheiro`),
   e só para programas com `milheiro_value_brl` definido.
2. **Saldos são lotes (`balances`).** Todo crédito cria um lote com validade; todo débito
   consome lotes em FIFO por vencimento (sem validade por último). Invariante:
   `soma(balances.remaining) == soma(transactions.points)` por conta. Use **sempre**
   `recordTransaction` / `transferPoints` (`src/server/services/ledger.ts`); nunca insira
   em `transactions`/`balances` direto (exceto em testes).
3. Sinal dos pontos por tipo é garantido também por `CHECK` no banco.
4. Excluir movimentação: só créditos cujo lote está intacto. O resto é corrigido com `ajuste`.
5. Toda consulta e mutação filtra por `userId` do `requireUser()`. Ids vindos do
   cliente são validados como uuid e checados quanto ao dono.
6. Funcionalidades não implementadas usam `<InDevelopment>`: nunca simular dados ou
   respostas de IA como se fossem reais.

## Segurança

- Senhas: bcrypt (custo 12). Login com mensagem genérica, hash fictício contra
  enumeração por tempo e rate limit em memória (5 tentativas / 15 min por IP+e-mail).
- Sessão: token aleatório de 32 bytes no cookie `mi_session` (httpOnly, sameSite=lax,
  secure em produção). No banco fica só o SHA-256 do token. 14 dias.
- Limite de crédito cifrado com AES-256-GCM (`APP_ENCRYPTION_KEY`). Não guardamos número,
  CVV, validade de cartão nem senhas de bancos/programas.
- Segredos só em variáveis de ambiente (`src/server/env.ts` valida). Nada sensível em
  componentes cliente; `server-only` protege os módulos de servidor.
- Cabeçalhos de segurança em `next.config.ts`.

## Gráficos

Siga a skill `dataviz`: cor segue a entidade (posição do programa na lista completa,
nunca o rank), sem eixo duplo, traços finos, legenda com 2+ séries e botão "Ver tabela"
em todo gráfico. A paleta categórica do modo claro tem 3 cores abaixo de 3:1 de contraste,
e por isso a visão em tabela é obrigatória. Validação:
`node <skill>/scripts/validate_palette.js "<hex...>" --mode light --surface "#ffffff"`.

## Comandos

```bash
pnpm dev                 # http://localhost:3000
pnpm db:generate         # gera migração a partir de schema.ts
pnpm db:migrate          # aplica migrações
pnpm db:seed             # usuário demo: demo@milhas.local / Demo12345678 (não roda em produção)
pnpm test                # vitest: unit + integração (usa TEST_DATABASE_URL, recriado a cada execução)
node tests/e2e/smoke.mjs # e2e no navegador, com o app rodando
pnpm typecheck && pnpm lint && pnpm build
```

## Convenções

- Interface e mensagens em português do Brasil. Datas civis como `YYYY-MM-DD` (string),
  "hoje" no fuso `America/Sao_Paulo` (`todayISO`).
- Formulários: `useActionForm` (evita o reset automático do React 19 em erro de validação).
- Números de formulário passam por `parseNumber` (aceita `1.234,56`, `50.000`, `2,5`).
- Server actions retornam `ActionState` (`{ ok, message, fieldErrors }`); erros de regra
  são `DomainError` (mensagem segura para o usuário).

## Agente Inteligente (Etapa 2)

Arquivos em `src/server/agent/`:
- `client.ts`: modelo `claude-opus-5-5`, SDK `@anthropic-ai/sdk`, chave em `MILHAS_ANTHROPIC_API_KEY` (ou `ANTHROPIC_API_KEY` fora do Claude Code); `baseURL` fixo, nunca herdado de `ANTHROPIC_BASE_URL`
  (sem ela, a página explica como ativar e o resto do app funciona).
- `prompt.ts`: prompt de sistema **estável** (fica em cache). Dados que mudam (data de
  hoje, propostas decididas) vão numa mensagem `role: "system"` após cada mensagem do usuário.
- `tools.ts`: 7 ferramentas de leitura (`consultar_*`, `calcular`) e 3 de proposta
  (`propor_lancamento`, `propor_transferencia`, `propor_viagem`). Entradas validadas com
  zod (a API não valida com `eager_input_streaming`). Ordem fixa da lista (cache).
- `run.ts`: loop manual com streaming. Histórico em `agent_messages` **só por acréscimo**
  (blocos exatamente como a API devolveu, inclusive `thinking` e `fallback`): nunca edite
  nem apague mensagens antigas. Todos os `tool_result` de um turno vão numa só mensagem.
  Trata `refusal`, `pause_turn`, `max_tokens` (responde os `tool_use` com erro) e limite de
  10 iterações. Avisos para a interface ficam em `agent_messages.notice` (nunca vão à API).
- `decide.ts`: confirma/recusa propostas. Revalida o payload e executa pelos mesmos
  serviços (`recordTransaction`, `transferPoints(input, tx)`), numa transação.
- Parâmetros da API: `thinking: adaptive`, `output_config.effort: "medium"`, cache
  automático no topo, fallback no servidor (`server-side-fallback-2026-07-01` +
  `fallbacks: "default"`).
- Rota `POST /api/agente` (SSE): checa Origin (CSRF), sessão, limite diário
  (`AGENT_DAILY_MESSAGE_LIMIT`). **Não ligue a chamada à API ao `request.signal`**: no
  Next ele dispara ao devolver a Response; o cancelamento usa o `cancel()` do stream.

Regras do agente: não acessa internet nem dados de mercado; nunca grava sem confirmação;
não recebe limite de crédito; mensagens de ferramenta em português.

Calculadoras (`src/lib/calculators`) e serviços (`src/server/services/*`) são a base das
ferramentas; o agente nunca acessa o banco por fora deles. `trips.ai_context` segue reservado.
- Skills instaladas no repositório e relevantes: `award-travel`, `flight-search`,
  `milhas-e-pontos`, `comparar-voos` (ver `.claude/skills/`). Ainda não usadas em runtime.
