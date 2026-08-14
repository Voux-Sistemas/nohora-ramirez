#!/bin/sh
#
# Prova que o backup restaura.
#
# Backup nunca restaurado é esperança, não backup. A maneira de um backup
# falhar é silenciosa: o ficheiro sobe todos os dias, do tamanho certo, e no dia
# do resgate descobre-se que nunca voltou. Este script é o que impede isso — uma
# vez por semana descarrega o ficheiro que acabou de subir, restaura-o e confere
# se o que voltou é o banco a sério.
#
# Descarrega do bucket de propósito, em vez de reaproveitar o ficheiro em /tmp:
# assim a prova cobre a corrente inteira, incluindo o upload e a leitura de volta.
#
# O destino do restore é um Postgres EFÉMERO, levantado aqui dentro do
# contentor, que morre no fim. Já foi um `create database` no próprio servidor
# de produção, e isso caiu por dois motivos. O primeiro é prático: o banco passou
# a ser o Supabase (ADR-009), onde o papel da aplicação não cria bases e o pooler
# fixa a base da ligação — o script simplesmente não corria. O segundo é melhor:
# uma prova de backup não devia precisar de credencial de administrador do banco
# vivo para acontecer. Agora não toca em produção em momento nenhum; só lê o
# ficheiro do bucket. É por isso que a imagem é `postgres:18-alpine` inteira e
# não um cliente solto — o servidor que ela traz é exatamente o que se usa aqui.
set -eu

: "${BUCKET:?BUCKET não definida}"
: "${ENDPOINT:?ENDPOINT não definida}"
ARQUIVO="${1:?uso: verificar.sh <nome-do-ficheiro-no-bucket>}"

PGDATA=/tmp/verificar-pgdata
SOCKET=/tmp/verificar-sock
DUMP=/tmp/verificar.sql.gz
RASCUNHO=restore_check

# O caminho dos binários resolve-se aqui, como root, onde o PATH da imagem
# ainda vale. Dentro do `su` ele pode ser reescrito, e um `initdb: not found`
# a meio da noite não diz nada sobre a causa.
BIN="$(dirname "$(command -v initdb)")"

# Corre como o utilizador postgres: o initdb recusa-se a arrancar como root, e
# com razão. O `gosu` é o que a própria imagem oficial usa no entrypoint dela;
# o `su` fica como rede de segurança para o dia em que a imagem deixar de o
# trazer. Nenhum dos dois garante o PATH, e é por isso que os binários acima
# são resolvidos por caminho absoluto.
if command -v gosu >/dev/null 2>&1; then
  como_postgres() { gosu postgres /bin/sh -c "$1"; }
else
  como_postgres() { su postgres -c "$1"; }
fi

psql_rascunho() {
  como_postgres "$BIN/psql -h '$SOCKET' -U postgres -d $RASCUNHO -tAc \"$1\""
}

# O rascunho nasce e morre aqui, e nada vindo de variável de ambiente decide
# onde este script escreve — é a diferença entre um teste e um acidente.
limpar() {
  como_postgres "$BIN/pg_ctl -D $PGDATA -m immediate stop" >/dev/null 2>&1 || true
  rm -rf "$PGDATA" "$SOCKET" "$DUMP"
}
trap limpar EXIT

aws s3 cp "s3://$BUCKET/$ARQUIVO" "$DUMP" --endpoint-url "$ENDPOINT" >/dev/null

# Gzip corrompido a meio é a falha que passa por boa: o ficheiro existe, tem
# tamanho, e só se descobre no dia do resgate. Aqui descobre-se hoje.
gunzip -t "$DUMP"

rm -rf "$PGDATA" "$SOCKET"
mkdir -p "$PGDATA" "$SOCKET"
chown postgres "$PGDATA" "$SOCKET"

como_postgres "$BIN/initdb -D $PGDATA -U postgres --auth=trust" >/dev/null

# A configuração vai por ficheiro em vez de `pg_ctl -o`: são aspas dentro de
# aspas dentro do `su`, e cada camada é uma hipótese de o servidor subir com
# uma opção que ninguém pediu.
#
# `listen_addresses` vazio é o que interessa aqui — este servidor existe
# durante segundos, atende só no socket de ficheiro e nunca vê a rede. O resto
# é velocidade: sem fsync o restore não espera pelo disco, e um banco que vai
# ser apagado a seguir não tem o que proteger de uma falha de energia.
cat >> "$PGDATA/postgresql.conf" <<CONF
listen_addresses = ''
unix_socket_directories = '$SOCKET'
fsync = off
full_page_writes = off
synchronous_commit = off
CONF

como_postgres "$BIN/pg_ctl -D $PGDATA -w start" >/dev/null
como_postgres "$BIN/createdb -h '$SOCKET' -U postgres $RASCUNHO"

# Sem ON_ERROR_STOP: quem julga o restore é a contagem lá embaixo, não um aviso
# solto do psql. O dump sai com --no-owner e --no-privileges, mas ainda traz
# comandos que um Postgres virgem recusa sem consequência (extensões já
# presentes, GRANT a papéis do Supabase que aqui não existem). O que importa é
# se o banco voltou inteiro.
gunzip -c "$DUMP" \
  | como_postgres "$BIN/psql -h '$SOCKET' -U postgres -d $RASCUNHO -q -o /dev/null" 2>/dev/null \
  || true

TABELAS=$(psql_rascunho "select count(*) from information_schema.tables where table_schema = 'public'")
TRAVAS=$(psql_rascunho "select count(*) from pg_constraint where contype = 'x'")

echo "restore: $TABELAS tabelas, $TRAVAS travas de exclusão"

# O schema tem 40 tabelas hoje. O piso é 30 para uma migração poder acrescentar
# ou tirar alguma sem transformar a prova em alarme falso — mas um restore pela
# metade não passa por baixo dele.
#
# As duas travas de exclusão são as anti-overbooking, e são a parte do banco que
# mais dói perder: sem elas o sistema aceita dois clientes no mesmo horário. Um
# restore que traz as tabelas mas não traz as travas passaria por bom — aqui
# não passa.
if [ "$TABELAS" -lt 30 ] || [ "$TRAVAS" -lt 2 ]; then
  echo "FALHOU: o restore não trouxe o banco inteiro" >&2
  exit 1
fi

echo "RESTORE OK: $ARQUIVO"
