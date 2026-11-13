# Milhas Inteligentes AI

Aplicativo web para gerenciar pontos, milhas, cartões de crédito e viagens: saldos por
programa e por validade, histórico de movimentações, comparação de cartões e
calculadoras de milheiro, com dashboard e modo claro/escuro.

> **Status:** Etapa 1 concluída e aprovada. Etapa 2 (Agente Inteligente), entrega 1
> concluída. Radar de oportunidades segue **Em desenvolvimento**. Ver [ROADMAP.md](ROADMAP.md).

## Funcionalidades

| Módulo | Situação | O que faz |
|---|---|---|
| Dashboard | ✅ | Valor estimado em R$, economia acumulada, contagens, saldo por programa, pontos vencendo, acumulado no mês e 5 gráficos (evolução, distribuição, movimentações, acúmulo por cartão, resgates), com filtros de período e programa |
| Meus Cartões | ✅ | Cadastro, edição, exclusão e comparação de retorno anual |
| Programas de Fidelidade | ✅ | Livelo, Esfera, Smiles, LATAM Pass, Azul e outros do catálogo, ou programa personalizado. Saldo, validade, clube, custo e histórico |
| Minhas Milhas | ✅ | Acúmulos (com cartão), bônus, compras, resgates (com economia), expirações, ajustes e transferências com paridade e bônus |
| Calculadoras | ✅ | Custo por milheiro, transferência bonificada, compra de pontos, dinheiro x milhas, retorno anual de cartão e clube de pontos. Cada uma explica o cálculo e permite salvar simulações |
| Planejador de Viagens | 🟡 parcial | Cadastro de viagens e progresso do saldo. Busca automática em desenvolvimento |
| Alertas | 🟡 parcial | Vencimentos, pontos vencidos, clubes deficitários e viagens sem saldo. Notificações em desenvolvimento |
| Configurações | ✅ | Perfil, cotação do dólar, janela de alertas, tema, troca de senha e saída de todos os dispositivos |
| Radar de Oportunidades | 🚧 | Em desenvolvimento |
| Agente Inteligente | ✅ | Chat com IA que consulta seus dados, faz as contas e propõe lançamentos, transferências e viagens. Nada é gravado sem sua confirmação. Requer `MILHAS_ANTHROPIC_API_KEY` |

## Requisitos

- Node.js 20.9+ (testado com 22) e pnpm 10
- PostgreSQL 14+ (testado com 16)

## Como rodar

```bash
cd milhas-inteligentes-ai
pnpm install
cp .env.example .env.local
# edite .env.local: DATABASE_URL, TEST_DATABASE_URL e APP_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # gera a chave
```

Crie os bancos (exemplo com um usuário `milhas`):

```bash
sudo -u postgres psql -c "CREATE ROLE milhas LOGIN PASSWORD 'troque-esta-senha' CREATEDB"
sudo -u postgres createdb -O milhas milhas_inteligentes
sudo -u postgres createdb -O milhas milhas_inteligentes_test
```

Aplique as migrações e, se quiser, crie o usuário de demonstração:

```bash
pnpm db:migrate
pnpm db:seed      # demo@milhas.local / Demo12345678 (dados fictícios)
pnpm dev          # http://localhost:3000
```

## Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL do app |
| `TEST_DATABASE_URL` | Banco dos testes de integração. **É apagado e recriado** a cada `pnpm test`; o nome precisa terminar em `_test` |
| `MILHAS_ANTHROPIC_API_KEY` | Chave da API do Claude para o Agente Inteligente. Opcional: sem ela o agente fica desativado. `ANTHROPIC_API_KEY` também é aceita, mas em sessões do Claude Code esse nome é reservado pela plataforma |
| `ALLOW_SIGNUP` | Padrão `false`: o cadastro só abre enquanto não existe nenhuma conta (uso pessoal). `true` mantém aberto (desenvolvimento e testes) |
| `DATABASE_POOL_MAX` | Conexões com o banco por instância (padrão 10; use 3 na Vercel) |
| `AGENT_DAILY_MESSAGE_LIMIT` | Mensagens por usuário por dia ao agente (padrão 60) |
| `APP_ENCRYPTION_KEY` | 32 bytes em base64 para AES-256-GCM (limite de crédito). Trocar a chave torna ilegíveis os limites já salvos |

## Testes

```bash
pnpm test                    # unitários + integração (vitest)
pnpm dev & node tests/e2e/smoke.mjs   # ponta a ponta no navegador (Playwright)
pnpm typecheck && pnpm lint && pnpm build
```

## Scripts

| Script | Descrição |
|---|---|
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm db:generate` | Gera migração a partir de `src/server/db/schema.ts` |
| `pnpm db:migrate` | Aplica migrações pendentes |
| `pnpm db:seed` | Recria o usuário de demonstração (bloqueado em produção) |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm test` / `typecheck` / `lint` | Qualidade |

## Segurança

- Não pedimos nem armazenamos senhas de bancos, cartões ou programas de fidelidade, nem
  número/CVV de cartões.
- Senhas de acesso com bcrypt, sessões com token hasheado no banco e cookie httpOnly.
- Limite de crédito cifrado (AES-256-GCM).
- Detalhes em [CLAUDE.md](CLAUDE.md#segurança).

## Publicar para uso pessoal

Passo a passo em [DEPLOY.md](DEPLOY.md) (Vercel + Neon, só pelo navegador).

## Documentação

- [CLAUDE.md](CLAUDE.md): arquitetura, regras de domínio e convenções
- [ROADMAP.md](ROADMAP.md): etapas e pendências
- [CHANGELOG.md](CHANGELOG.md): histórico de versões
