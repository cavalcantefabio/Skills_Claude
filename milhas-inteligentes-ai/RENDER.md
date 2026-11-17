# Publicar para uso pessoal (Render + Neon)

Alternativa à Vercel (`DEPLOY.md`). O app fica num endereço `https://….onrender.com`, protegido
por login. **O cadastro só fica aberto até você criar a sua conta.** Tudo é feito pelo navegador.

**Limitação do plano gratuito do Render:** depois de cerca de 15 minutos sem uso, o app "dorme". O
primeiro acesso seguinte leva perto de 1 minuto para carregar; depois fica rápido. O plano pago mais
barato do Render elimina essa espera.

> Dica: se o notebook da empresa bloquear algum site, faça a configuração pelo celular, usando dados
> móveis.

## 1. Criar o banco de dados no Neon

1. Acesse **neon.tech** e clique em **Sign Up**. Pode entrar com o GitHub ou com e-mail.
2. Crie um projeto:
   - **Project name:** `milhas`
   - **Postgres version:** a padrão (16 ou mais nova)
   - **Region:** **AWS US East (N. Virginia)**. Use a mesma região dos EUA que vai escolher no Render
     (passo 3): banco e app perto um do outro deixam o app bem mais rápido.
3. No painel do projeto, clique em **Connect** (ou **Connection Details**).
4. **Desligue a opção "Connection pooling"** e copie a **connection string**. Ela começa com
   `postgresql://` e termina com `?sslmode=require`. Guarde-a para o passo 3.

## 2. Criar a conta no Render

1. Acesse **render.com** e clique em **Get Started**.
2. Escolha **GitHub** e entre com a conta `cavalcantefabio`.
3. Quando o Render pedir acesso aos repositórios, libere pelo menos o **Skills_Claude**.

## 3. Criar o serviço do app

1. No painel do Render, clique em **New → Web Service**.
2. Escolha o repositório **Skills_Claude** e clique em **Connect**.
3. Preencha exatamente assim:

| Campo | Valor |
|---|---|
| **Name** | `milhas-inteligentes` (vira parte do endereço) |
| **Language / Runtime** | `Node` |
| **Branch** | `main` |
| **Region** | **Virginia (US East)** |
| **Root Directory** | `milhas-inteligentes-ai` |
| **Build Command** | `bash scripts/render-build.sh` |
| **Start Command** | `npm run start` |
| **Instance Type** | **Free** |

4. Em **Environment Variables**, clique em **Add Environment Variable** para cada linha:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon (passo 1.4) |
| `APP_ENCRYPTION_KEY` | a chave de 32 bytes em base64 que o Claude gerou para você |
| `MILHAS_ANTHROPIC_API_KEY` | sua chave da API do Claude (`sk-ant-…`) |
| `AGENT_DAILY_MESSAGE_LIMIT` | `20` |
| `DATABASE_POOL_MAX` | `5` |

   Não crie `ALLOW_SIGNUP` nem `NODE_ENV`.

5. Abra **Advanced** e, em **Health Check Path**, coloque `/login`.
6. Clique em **Deploy Web Service**.

## 4. Acompanhar a publicação

1. O Render abre a tela de **Logs**. O build leva de 2 a 5 minutos.
2. No log devem aparecer `Migrações aplicadas.` e, no fim, `Your service is live`.
3. O endereço aparece no topo da página, no formato `https://milhas-inteligentes.onrender.com`
   (o Render pode acrescentar letras ao nome).

## 5. Criar a sua conta (faça logo em seguida)

1. Abra o endereço e clique em **Criar conta**.
2. Cadastre-se com seu e-mail e uma senha forte.
3. Pronto: o cadastro fecha automaticamente. Para conferir, abra `/cadastro` numa janela anônima:
   deve aparecer **"Cadastro fechado"**.

> Faça o passo 5 assim que o deploy terminar: até a primeira conta existir, o cadastro fica aberto
> para quem tiver o endereço.

## 6. Usar no dia a dia

- Salve o endereço nos favoritos. No celular, use **Adicionar à tela inicial**.
- Cada mudança aprovada na branch `main` é publicada sozinha, com as migrações do banco aplicadas
  automaticamente no build.

## 7. Busca automática de voos e notificações (0.12.0)

A busca de Alertas de Voos roda sozinha por volta de **8h e 20h** (Brasília). Quem chama o app nesses
horários é o GitHub Actions (gratuito), com uma senha que só o Render e o GitHub conhecem.

1. **Crie a senha.** Peça ao Claude uma senha aleatória (ou use um gerador de senhas) com pelo menos
   24 caracteres, só letras e números.
2. **Render:** no serviço, abra **Environment** → **Add Environment Variable**: nome `CRON_SECRET`,
   valor = a senha. Clique em **Save, rebuild and deploy**.
3. **GitHub:** no repositório, abra **Settings** → **Secrets and variables** → **Actions** →
   **New repository secret** e crie dois segredos:
   - `MILHAS_APP_URL`: o endereço do app (ex.: `https://milhas-inteligentes.onrender.com`).
   - `MILHAS_CRON_SECRET`: a mesma senha do passo 2.
4. **Testar:** no GitHub, aba **Actions** → **Milhas - busca automática de voos** → **Run workflow**.
   Em 2 a 3 minutos a execução fica verde e a página Alertas de Voos mostra "Última busca (automática)".

**Notificações no celular (iPhone):** abra o app no Safari → Compartilhar → **Adicionar à Tela de
Início**. Abra pelo ícone novo, entre, vá em **Configurações → Notificações no celular** e toque em
**Ativar notificações neste aparelho**. Use **Enviar teste** para conferir. No Android, use o Chrome
(não precisa instalar). Custo da busca automática: ~US$ 0,30 por busca, ~US$ 18 por mês.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Build falha em `db:migrate` com erro de conexão | Confira a `DATABASE_URL`: precisa ser a string do Neon completa, com `?sslmode=require`, e sem pooling. |
| Build falha com `APP_ENCRYPTION_KEY deve ter 32 bytes` | A chave foi copiada incompleta. Cole de novo, inclusive o `=` do final. |
| Página do agente diz "Agente não configurado" | Falta `MILHAS_ANTHROPIC_API_KEY`. Adicione em **Environment** e clique em **Save, rebuild and deploy**. |
| A execução no GitHub Actions falha com 401 | `MILHAS_CRON_SECRET` (GitHub) e `CRON_SECRET` (Render) estão diferentes. Cadastre de novo. |
| A execução falha com 503 | Falta `CRON_SECRET` no Render (ou o deploy ainda não terminou). |
| O app demora para abrir | O plano gratuito estava "dormindo". Espere cerca de 1 minuto. |
| Aparece "Cadastro fechado" antes de você criar a conta | Alguém criou a primeira conta antes de você. Peça ao Claude para limpar o banco e recomeçar. |

## Se a Vercel liberar a sua conta depois

Você pode continuar no Render ou migrar para a Vercel seguindo o `DEPLOY.md`. Para migrar sem perder
dados, use na Vercel a mesma `DATABASE_URL` do Neon e a mesma `APP_ENCRYPTION_KEY`.
