#!/bin/sh
#
# Backup diário do banco de produção.
#
# Corre como cron service na Railway: sobe, faz o dump, manda para o bucket e
# sai. Nada fica de pé entre uma execução e outra, portanto o custo é alguns
# segundos de CPU por dia mais cêntimos de armazenamento.
#
# O dump é lógico (pg_dump), não snapshot de disco. Restaura em qualquer
# Postgres 18, dentro ou fora da Railway — e isso importa mais do que parece:
# backup que só restaura na plataforma de origem deixa-nos reféns dela no pior
# dia possível.
set -eu

: "${DATABASE_URL:?DATABASE_URL não definida}"
: "${BUCKET:?BUCKET não definida}"
: "${ENDPOINT:?ENDPOINT não definida}"
RETENCAO="${RETENCAO:-30}"

# Virtual-hosted style: o bucket vira subdomínio do endpoint. Sem isto o
# cliente monta a URL no formato antigo, de caminho, e não acha o bucket.
aws configure set default.s3.addressing_style virtual

ARQUIVO="$(date -u +%Y-%m-%dT%H%M).sql.gz"

# --no-owner e --no-privileges: os papéis do Postgres da Railway não existem
# em outro lugar. Sem isso o restore quebra em cada GRANT de um dono ausente,
# justamente quando o destino é outra máquina — que é o caso que importa.
#
# Dump e compressão em dois passos, e não num cano.
#
# `set -e` não vê a morte do pg_dump dentro de um cano: em sh o estado de saída
# de um cano é o do ÚLTIMO comando, que era o gzip, e o gzip teve sucesso. Com
# a senha do banco rodada, ou o Supabase em baixo, o pg_dump morria em stderr,
# o gzip lia EOF e escrevia um ficheiro válido de 20 bytes — cabeçalho e rodapé
# de gzip, sem uma linha do salão lá dentro.
#
# A guarda de baixo foi escrita para apanhar exactamente isto, e não apanhava:
# media o ficheiro COMPRIMIDO, e 20 bytes não é zero. Um `pipefail` resolveria,
# mas o ash da imagem alpine não o garante; dois passos resolvem em qualquer sh.
if ! pg_dump --no-owner --no-privileges "$DATABASE_URL" > /tmp/dump.sql; then
  echo "FALHOU: o pg_dump não completou" >&2
  exit 1
fi

# O piso é sobre o dump por comprimir, onde um banco vazio é mesmo pequeno. O
# deste salão anda pelas centenas de KB; 50 KB apanha o dump truncado a meio e
# o dump do banco errado (os antigos, pré-Supabase, tinham 8 KB).
TAMANHO=$(wc -c < /tmp/dump.sql)
if [ "$TAMANHO" -lt 51200 ]; then
  echo "FALHOU: o dump saiu com $TAMANHO bytes — pequeno demais para ser este banco" >&2
  exit 1
fi

gzip -9 -c /tmp/dump.sql > "/tmp/$ARQUIVO"
rm -f /tmp/dump.sql

aws s3 cp "/tmp/$ARQUIVO" "s3://$BUCKET/$ARQUIVO" --endpoint-url "$ENDPOINT"

echo "BACKUP OK: $ARQUIVO ($(du -h "/tmp/$ARQUIVO" | cut -f1))"

# A prova do restore. Semanal por padrão: diário dobraria o trabalho sem dobrar
# a informação, e nunca é como backup apodrece em silêncio. `sempre` serve para
# conferir na hora, sem esperar domingo.
VERIFICAR="${VERIFICAR:-semanal}"
case "$VERIFICAR" in
  sempre)
    /bin/sh /usr/local/bin/verificar.sh "$ARQUIVO"
    ;;
  semanal)
    # `if`, não `teste && comando`: com set -e um teste falso na última linha
    # derrubaria o script inteiro, e "hoje não é domingo" viraria backup falhado.
    if [ "$(date -u +%u)" = "7" ]; then
      /bin/sh /usr/local/bin/verificar.sh "$ARQUIVO"
    fi
    ;;
  nunca) ;;
  *)
    echo "VERIFICAR inválido: $VERIFICAR (use sempre, semanal ou nunca)" >&2
    exit 1
    ;;
esac

# A poda só depois da prova, e é de propósito.
#
# Estava antes, e por isso uma noite em que a cópia sai má fazia duas coisas ao
# mesmo tempo: subia lixo e expirava um backup que prestava. Trinta noites assim
# e o bucket tem trinta ficheiros com nomes certos e nada dentro. Agora uma
# corrida que falha sai por `set -e` antes de aqui chegar, e a margem de trinta
# dias fica intacta enquanto ninguém for ver o que se passou.
#
# O nome é ISO, então ordem alfabética é ordem cronológica. Guarda os N mais
# recentes e apaga o resto — senão o bucket cresce para sempre sem ninguém ver.
aws s3 ls "s3://$BUCKET/" --endpoint-url "$ENDPOINT" \
  | awk '{print $4}' \
  | sort -r \
  | tail -n "+$((RETENCAO + 1))" \
  | while read -r antigo; do
      echo "expirando $antigo"
      aws s3 rm "s3://$BUCKET/$antigo" --endpoint-url "$ENDPOINT"
    done
