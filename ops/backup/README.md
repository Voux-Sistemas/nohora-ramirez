# Backup do banco de produção

Serviço separado na Railway, apontado para **este diretório** como raiz. É por
isso que ele mora aqui e não na raiz do repositório: a Railway procura o
`railway.json` a partir da raiz do serviço, e um serviço com raiz no
repositório inteiro herdaria o build da aplicação web — foi exatamente o que
aconteceu antes desta pasta existir, e o serviço de backup subiu rodando o
Next.js.

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
