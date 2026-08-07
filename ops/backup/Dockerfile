# Imagem do serviço de backup. Só existe para ter o pg_dump certo e o cliente
# de S3 no mesmo lugar.
#
# A versão é casada de propósito com o servidor: pg_dump se recusa a dumpar um
# Postgres mais novo que ele. Quando a Railway subir o banco para 19, esta
# linha sobe junto — e o serviço falha alto no dia, em vez de silenciosamente
# parar de gerar backup.
FROM postgres:18-alpine

RUN apk add --no-cache aws-cli

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# A imagem oficial traz um entrypoint que inicializa um banco novo e ignora o
# comando que a gente passa. Aqui não há banco para inicializar: só queremos o
# pg_dump que veio junto. Zerar o entrypoint é o que faz o script rodar.
ENTRYPOINT []
CMD ["/bin/sh", "/usr/local/bin/backup.sh"]
