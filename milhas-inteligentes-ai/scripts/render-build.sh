#!/usr/bin/env bash
# Build no Render: instala dependências, aplica migrações no banco e compila o app.
# O pnpm roda via npx (versão fixa), sem precisar de instalação global no servidor.
set -euo pipefail
PNPM="npx --yes pnpm@10.28.0"
$PNPM install --frozen-lockfile
$PNPM db:migrate
$PNPM build
