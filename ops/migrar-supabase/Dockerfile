# Job de uma execução: copia o banco de produção da Railway para o Supabase.
#
# Mesma imagem do serviço de backup, pelo mesmo motivo: pg_dump se recusa a
# dumpar um Postgres mais novo que ele, então a versão precisa casar com a
# origem.
FROM postgres:18-alpine

COPY migrar.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/migrar.sh

# A imagem oficial traz um entrypoint que inicializa um banco novo e ignora o
# comando que passamos. Aqui não há banco para inicializar.
ENTRYPOINT []
CMD ["/bin/sh", "/usr/local/bin/migrar.sh"]
