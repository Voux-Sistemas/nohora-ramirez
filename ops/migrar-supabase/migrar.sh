#!/bin/sh
#
# Copia o banco de ORIGEM para DESTINO, uma vez.
#
# Corre como serviço da Railway porque o Postgres de origem só existe na rede
# privada — não tem endereço público, e pg_dump/psql não estão instalados fora
# daqui. Sobe, copia, sai. Os dados de produção nunca passam por uma máquina
# de desenvolvedor.
#
# O dump é lógico e completo: schema, dados, o histórico de migrations
# aplicadas (a tabela __drizzle_migrations viaja junto) e as travas
# anti-overbooking, porque a origem já tem tudo isso. Não existe um passo
# separado de "aplicar migration" aqui — é a origem, copiada como está.
#
# DESTINO precisa ser um banco vazio. O dump traz CREATE TABLE sem
# IF NOT EXISTS: rodar duas vezes contra o mesmo destino falha na segunda,
# de propósito — não é para sobrescrever nada em silêncio.
set -eu

: "${ORIGEM:?ORIGEM não definida — DATABASE_URL do Postgres de origem}"
: "${DESTINO:?DESTINO não definida — pooler de SESSÃO do destino, porta 5432}"

echo "→ dumping origem…"
# --no-owner --no-privileges: os papéis desta origem não existem no destino.
# Sem isso o restore quebra em cada GRANT de um dono ausente.
pg_dump --no-owner --no-privileges "$ORIGEM" > /tmp/dump.sql

if [ ! -s /tmp/dump.sql ]; then
  echo "FALHOU: o dump saiu vazio" >&2
  exit 1
fi
echo "  $(du -h /tmp/dump.sql | cut -f1)"

echo "→ restaurando no destino…"
psql "$DESTINO" -q -v ON_ERROR_STOP=1 -f /tmp/dump.sql

TABELAS=$(psql "$DESTINO" -tAc \
  "select count(*) from information_schema.tables where table_schema = 'public'")
TRAVAS=$(psql "$DESTINO" -tAc \
  "select count(*) from pg_constraint where contype = 'x'")

echo "migração: $TABELAS tabelas, $TRAVAS travas de exclusão"

# As mesmas duas travas que o verificar.sh do backup confere: sem elas o
# destino aceitaria dois clientes na mesma cadeira, no mesmo horário, sem
# ninguém perceber até o dia em que isso acontece de verdade.
if [ "$TABELAS" -lt 30 ] || [ "$TRAVAS" -lt 2 ]; then
  echo "FALHOU: o destino não recebeu o banco inteiro" >&2
  exit 1
fi

rm -f /tmp/dump.sql
echo "MIGRACAO OK"
