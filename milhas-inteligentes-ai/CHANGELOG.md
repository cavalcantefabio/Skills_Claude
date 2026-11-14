# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [0.9.0] - 2026-11-15 (Etapa complementar: Planejador inteligente de viagens)

### Adicionado
- **Minhas Viagens** (antes "Planejador de Viagens"): painel por viagem com destino, meta de milhas,
  saldo disponível, milhas restantes, percentual, custo estimado, estratégia recomendada e próximas ações.
- **Plano da viagem**: comparação de programas (meta, taxas, disponível com transferências, faltam,
  quanto rende cada milheiro, custo econômico, viável antes do embarque), dinheiro x milhas, cenários
  de acúmulo com prazo, simulador de gasto extra no cartão e compra mensal, evolução da meta e
  promoções do Radar ligadas à viagem.
- **Cotações** por passageiro, reais (consultadas) ou estimativas (com fonte obrigatória). Cotações
  reais têm prioridade sobre estimativas do mesmo programa.
- **Pesquisar referências (IA)**: busca na web (Claude Sonnet 5.5) salva estimativas com fonte;
  limite diário `TRIP_RESEARCH_DAILY_LIMIT` (padrão 5).
- Campos da viagem: só ida ou ida e volta, flexibilidade em dias, orçamento, programas considerados,
  antecedência do alerta e aviso de promoções.
- **Alertas** de meta em risco, promoção para a viagem e cotações só estimadas.
- **Agente MILHAS AI**: `analisar_viagem`, `consultar_viagens` com plano, `propor_viagem` com os novos
  campos e `propor_cotacao` (confirmação na tela); regras de viagem no prompt.
- Tabelas `trip_quotes` e `trip_accounts`; migrações 0008 a 0010 (a 0009 converte meta e preço antigos
  em cotações reais).

### Corrigido
- Transbordo horizontal no celular em tabelas dentro de grades (inclui a página do programa) e texto
  oculto de acessibilidade que escapava da área de rolagem.

### Testes
- 13 testes do motor de planejamento, 2 da pesquisa de referências e 1 de integração com o agente
  (99 no total). Teste ponta a ponta com 43 verificações.
- Teste real: agente respondeu às perguntas sobre Orlando com os números do plano; pesquisa de
  referências trouxe 8 estimativas com fonte por US$ 0,17.

## [0.8.0] - 2026-11-15 (Ciclo de melhoria contínua 2)

### Adicionado
- **Exportar meus dados** (Configurações → Seus dados):
  - Backup completo em JSON: perfil, programas, saldos por validade, movimentações, cartões (com
    limite decifrado), viagens, simulações, conversas com o agente (só o texto visível) e a última
    pesquisa do Radar. Campo `versao_formato` para futuras importações.
  - Movimentações e saldos por validade em CSV para o Excel em português (`;`, vírgula decimal,
    BOM UTF-8), com proteção contra injeção de fórmulas.
- Rota `GET /api/exportar?arquivo=completo|movimentacoes|saldos` (exige sessão; `no-store`).
- Nunca exporta hash de senha, sessões, tentativas de login ou chaves.

### Testes
- 6 testes novos (CSV e exportação), 84 no total; 6 verificações novas no teste ponta a ponta (39).

## [0.7.0] - 2026-11-15 (Ciclo de melhoria contínua 1)

### Corrigido
- **Pontos vencidos não entram mais no saldo.** O saldo mostrado (dashboard, programas, viagens,
  agente e Radar) passa a ser o disponível; lotes com validade passada aparecem à parte.
- **Débitos não consomem pontos vencidos.** Um resgate ou transferência só usa lotes válidos na data
  do lançamento (a exceção é a própria expiração).
- **Login protegido contra força bruta.** Limite por e-mail (10 falhas em 15 minutos, zerado por um
  login bem-sucedido) e por IP (30), guardado no banco: sobrevive a reinícios e não pode ser
  contornado forjando o IP. O IP passa a vir do proxy, não do primeiro valor de `X-Forwarded-For`.

### Adicionado
- Botão "Registrar expiração" na página do programa: baixa os lotes vencidos com lançamentos de
  expiração datados do vencimento.
- Limpeza automática de sessões expiradas e de tentativas de login com mais de 1 dia.
- Tabela `login_attempts` (migração 0007).

### Alterado
- `package.json` alinhado à versão do CHANGELOG.
- Ferramenta do agente: campo `saldo_disponivel` (antes `saldo`).

### Testes
- 10 testes de integração novos (vencimentos e limite de login), 78 no total.
- Teste ponta a ponta com 5 verificações novas (33 no total).

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
