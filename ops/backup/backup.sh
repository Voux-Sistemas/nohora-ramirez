#!/bin/sh
#
# Backup diário do banco de produção.
#
# Roda como cron service na Railway: sobe, dumpa, manda para o bucket e sai.
# Nada fica de pé entre uma execução e outra, então o custo é alguns segundos
# de CPU por dia mais centavos de armazenamento.
#
# O dump é lógico (pg_dump), não snapshot de disco. Ele restaura em qualquer
# Postgres 18, dentro ou fora da Railway — e isso importa mais do que parece:
# backup que só restaura na plataforma de origem deixa você refém dela no pior
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
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "/tmp/$ARQUIVO"

# Dump vazio é pior que dump nenhum: ele passa por bom até o dia do resgate.
if [ ! -s "/tmp/$ARQUIVO" ]; then
  echo "FALHOU: o dump saiu vazio" >&2
  exit 1
fi

aws s3 cp "/tmp/$ARQUIVO" "s3://$BUCKET/$ARQUIVO" --endpoint-url "$ENDPOINT"

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
