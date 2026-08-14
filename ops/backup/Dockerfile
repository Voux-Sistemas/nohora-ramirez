# Imagem do serviço de backup. Existe para ter três coisas no mesmo sítio: o
# pg_dump que tira a cópia, o cliente de S3 que a guarda, e o servidor Postgres
# onde o `verificar.sh` a restaura para provar que ela presta.
#
# A imagem é a do servidor inteiro, não um cliente solto, e isso é de propósito:
# a prova do restore levanta um Postgres efémero aqui dentro em vez de mexer no
# banco vivo. Sem `initdb` e `pg_ctl` na imagem, não haveria onde restaurar.
#
# A versão não pode ficar atrás do servidor: pg_dump recusa-se a dumpar um
# Postgres mais novo que ele. O banco é o Supabase (ADR-009); no dia em que ele
# subir de major, esta linha sobe junto — e o serviço falha alto nesse dia, em
# vez de silenciosamente parar de gerar backup.
FROM postgres:18-alpine

RUN apk add --no-cache aws-cli

COPY backup.sh verificar.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/verificar.sh

# A imagem oficial traz um entrypoint que inicializa um banco novo e ignora o
# comando que a gente passa. Aqui não há banco para inicializar: só queremos o
# pg_dump que veio junto. Zerar o entrypoint é o que faz o script rodar.
ENTRYPOINT []
CMD ["/bin/sh", "/usr/local/bin/backup.sh"]
