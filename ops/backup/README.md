# Backup do banco de produção

Serviço separado na Railway, com **duas** configurações que precisam estar
certas ao mesmo tempo:

| Ajuste do serviço | Valor |
| --- | --- |
| Root directory | `ops/backup` |
| Config file | `ops/backup/railway.json` |

Parece redundante e não é. A raiz do serviço resolve o **build** — é por ela
que a Railway acha o `Dockerfile` e encolhe o contexto para esta pasta. Mas o
caminho do arquivo de configuração é resolvido a partir da **raiz do
repositório**, ignorando a raiz do serviço. Com o config file em `railway.json`
e a raiz em `ops/backup`, a Railway lê o `railway.json` da aplicação web: o
container do backup nasce com `startCommand` de `next start` e com o
pre-deploy de migração, e morre sem log nenhum.

Foi assim que o serviço de backup subiu rodando o Next.js. O sintoma não fala
nada sobre a causa, então fica escrito aqui.

## Como funciona

Cron às 6h UTC (3h de Brasília). Sobe, roda `pg_dump`, comprime, manda para o
bucket `backups` do projeto e sai. Nada fica de pé entre execuções.

Retenção de 30 arquivos, controlada pela variável `RETENCAO`. O nome do
arquivo é ISO, então ordem alfabética é ordem cronológica e a poda é só
descartar o fim da lista.

## Variáveis

Todas por referência, nenhuma escrita à mão:

| Variável | Origem |
| --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `BUCKET` `ENDPOINT` | `${{backups.BUCKET}}` `${{backups.ENDPOINT}}` |
| `AWS_ACCESS_KEY_ID` `AWS_SECRET_ACCESS_KEY` `AWS_DEFAULT_REGION` | bucket `backups` |
| `RETENCAO` | quantos arquivos guardar (30) |

## Restaurar

O dump sai sem dono e sem privilégios, então entra em qualquer Postgres 18 —
inclusive fora da Railway. Com as credenciais do bucket no ambiente:

```sh
aws s3 ls s3://$BUCKET/ --endpoint-url $ENDPOINT
aws s3 cp s3://$BUCKET/<arquivo>.sql.gz . --endpoint-url $ENDPOINT
gunzip -c <arquivo>.sql.gz | psql "<url-do-banco-destino>"
```

Restaure sempre num banco vazio e descartável primeiro. Restaurar por cima de
produção é a decisão que não tem volta.
