#!/bin/sh
#
# Prova que o backup restaura.
#
# Backup nunca restaurado é esperança, não backup. O jeito de um backup falhar
# é silencioso: o arquivo sobe todo dia, do tamanho certo, e no dia do resgate
# descobre-se que ele nunca voltou. Este script é o que impede isso — uma vez
# por semana ele baixa o arquivo que acabou de subir, restaura num banco
# descartável e confere se o que voltou é o banco de verdade.
#
# Baixa do bucket de propósito, em vez de reaproveitar o arquivo em /tmp: assim
# a prova cobre a corrente inteira, inclusive o upload e a leitura de volta.
set -eu

ARQUIVO="$1"

# O banco de rascunho nasce e morre aqui, e o nome é constante escrita no
# código. Nada vindo de variável de ambiente decide onde este script escreve —
# é a diferença entre um teste e um acidente.
RASCUNHO=restore_check

BASE="${DATABASE_URL%/*}"
ORIGEM="${DATABASE_URL##*/}"
ORIGEM="${ORIGEM%%\?*}"

if [ "$ORIGEM" = "$RASCUNHO" ]; then
  echo "FALHOU: DATABASE_URL aponta para o banco de rascunho" >&2
  exit 1
fi

ADMIN="$BASE/postgres"
DESTINO="$BASE/$RASCUNHO"

aws s3 cp "s3://$BUCKET/$ARQUIVO" "/tmp/verificar.sql.gz" --endpoint-url "$ENDPOINT" >/dev/null

psql "$ADMIN" -q -v ON_ERROR_STOP=1 \
  -c "drop database if exists $RASCUNHO" \
  -c "create database $RASCUNHO"

# Sem ON_ERROR_STOP: quem julga o restore é a contagem lá embaixo, não um aviso
# solto do psql. O que importa é se o banco voltou inteiro.
gunzip -c /tmp/verificar.sql.gz | psql "$DESTINO" -q -o /dev/null

TABELAS=$(psql "$DESTINO" -tAc \
  "select count(*) from information_schema.tables where table_schema = 'public'")
TRAVAS=$(psql "$DESTINO" -tAc \
  "select count(*) from pg_constraint where contype = 'x'")

psql "$ADMIN" -q -c "drop database if exists $RASCUNHO"
rm -f /tmp/verificar.sql.gz

echo "restore: $TABELAS tabelas, $TRAVAS travas de exclusão"

# As duas travas de exclusão são as anti-overbooking, e são a parte do banco
# que mais dói perder: sem elas o sistema aceita dois clientes no mesmo
# horário. Um restore que traz as tabelas mas não traz as travas passaria por
# bom — aqui não passa.
if [ "$TABELAS" -lt 30 ] || [ "$TRAVAS" -lt 2 ]; then
  echo "FALHOU: o restore não trouxe o banco inteiro" >&2
  exit 1
fi

echo "RESTORE OK: $ARQUIVO"
