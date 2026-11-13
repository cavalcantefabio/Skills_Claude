# Publicar para uso pessoal (Vercel + Neon)

O app fica num endereço `https://….vercel.app`, protegido por login. **O cadastro só fica
aberto até você criar a sua conta**; depois disso ninguém mais consegue se cadastrar.
Tudo é feito pelo navegador, sem instalar nada. Os planos gratuitos da Vercel e do Neon
bastam para uma pessoa; o único custo é o do agente (cerca de US$ 0,05 por mensagem).

## 1. Criar a conta na Vercel

1. Acesse **vercel.com** e clique em **Sign Up**.
2. Escolha o plano **Hobby** (gratuito) e **Continue with GitHub**, usando a conta onde está o
   repositório `Skills_Claude`.
3. Autorize a Vercel a acessar o GitHub quando ela pedir.

## 2. Importar o projeto

1. No painel da Vercel, clique em **Add New… → Project**.
2. Na lista de repositórios, encontre **Skills_Claude** e clique em **Import**.
   Se ele não aparecer, clique em **Adjust GitHub App Permissions** e libere o repositório.
3. Em **Root Directory**, clique em **Edit** e escolha a pasta **`milhas-inteligentes-ai`**.
   Este passo é obrigatório: o app fica dentro dessa pasta.
4. **Framework Preset**: deve aparecer **Next.js** sozinho. Não altere os comandos de build:
   o arquivo `vercel.json` do projeto já aplica as migrações do banco antes de cada build.
5. **Ainda não clique em Deploy.** Abra **Environment Variables** e siga o passo 3.

## 3. Variáveis de ambiente

Adicione uma a uma (nome à esquerda, valor à direita):

| Nome | Valor |
|---|---|
| `APP_ENCRYPTION_KEY` | Uma chave nova de 32 bytes em base64. Peça ao Claude para gerar uma, ou use um gerador de chaves base64 de 32 bytes. **Guarde-a**: se ela for perdida, os limites de cartão salvos ficam ilegíveis. |
| `MILHAS_ANTHROPIC_API_KEY` | Sua chave da API do Claude (`sk-ant-…`). De preferência, crie uma chave separada para a produção. |
| `AGENT_DAILY_MESSAGE_LIMIT` | `20` (ou o limite diário que preferir) |
| `DATABASE_POOL_MAX` | `3` |

Não crie `DATABASE_URL` aqui: ela é criada sozinha no passo 5. Não crie `ALLOW_SIGNUP`.

Agora clique em **Deploy**. **O primeiro deploy vai falhar** por falta do banco de dados. Isso é
esperado; siga para o passo 4.

## 4. Criar o banco de dados (Neon)

1. Abra o projeto na Vercel e vá à aba **Storage**.
2. Clique em **Create Database** (ou **Browse Marketplace**) e escolha **Neon** (Serverless Postgres).
3. Aceite os termos, escolha o plano **Free** e a região **São Paulo (sa-east-1)**, se aparecer;
   senão, a mais próxima.
4. Dê um nome, por exemplo `milhas`, e confirme.
5. Na tela seguinte, **conecte o banco ao projeto** marcando os ambientes **Production** e **Preview**.
   A Vercel cria sozinha as variáveis `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.

## 5. Publicar de novo

1. Vá à aba **Deployments**.
2. No deploy que falhou, clique em **⋯ → Redeploy** e confirme.
3. Aguarde o status **Ready** (cerca de 1 a 2 minutos). No log do build deve aparecer
   `Migrações aplicadas.`.

## 6. Criar a sua conta (faça logo em seguida)

1. Clique em **Visit** (ou no domínio `….vercel.app` em **Domains**).
2. Clique em **Criar conta** e cadastre-se com seu e-mail e uma senha forte.
3. Pronto: o cadastro fecha automaticamente. Confira abrindo `/cadastro` numa janela anônima:
   deve aparecer **"Cadastro fechado"**.

> Faça o passo 6 assim que o deploy terminar: até a primeira conta existir, o cadastro está aberto
> para quem tiver o endereço.

## 7. Usar no dia a dia

- Salve o endereço nos favoritos do navegador.
- No celular, abra o endereço e use **Adicionar à tela inicial**: o app vira um ícone.
- Cada atualização que o Claude fizer e for aprovada na branch `main` é publicada sozinha,
  com as migrações do banco aplicadas automaticamente.

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| Build falha com `DATABASE_URL` | O banco não foi conectado ao projeto (passo 4.5). Em **Storage**, abra o banco e clique em **Connect Project**. |
| Build falha com `APP_ENCRYPTION_KEY deve ter 32 bytes` | A chave não tem 32 bytes em base64. Gere outra. |
| Página do agente diz "Agente não configurado" | Falta `MILHAS_ANTHROPIC_API_KEY`. Adicione em **Settings → Environment Variables** e faça **Redeploy**. |
| Esqueci a senha | Ainda não há recuperação por e-mail. Peça ao Claude para gerar um comando de redefinição pelo banco Neon. |

## Segurança

- O banco Neon e a Vercel guardam seus dados de pontos e cartões (sem número, CVV ou senhas de
  bancos, que o app nunca pede).
- Para encerrar o acesso em todos os dispositivos: **Configurações → Sair de todos os dispositivos**.
- Se a chave da API vazar, revogue-a no console da Anthropic, crie outra e atualize a variável.
