#!/usr/bin/env bash
# Do contentor vazio até ao site pronto. Corre uma vez, sozinho, quando o
# Codespace nasce — ninguém escreve isto à mão.
set -euo pipefail

cd /workspaces/estudio

if [ ! -f .env ]; then
  # O `.env.example` aponta para localhost porque é isso que serve a quem
  # programa na sua máquina. Aqui dentro, localhost é este contentor e o
  # Postgres está no do lado — chama-se pelo nome do serviço do compose.
  sed 's#@localhost:5432#@banco:5432#' .env.example > .env
  echo "→ .env criado, apontado ao Postgres do contentor \"banco\""
fi

# Dependências, schema, travas anti-overbooking e o salão de demonstração.
# O guarda-freio de não semear um banco que não é de teste vive lá dentro.
npm run preparar
