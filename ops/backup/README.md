# Backup do banco de produção

Serviço separado na Railway, com **duas** configurações que precisam de estar
certas ao mesmo tempo:

| Ajuste do serviço | Valor |
| --- | --- |
| Root directory | `ops/backup` |
| Config file | `ops/backup/railway.json` |

Parece redundante e não é. A raiz do serviço resolve o **build** — é por ela
que a Railway encontra o `Dockerfile` e encolhe o contexto para esta pasta. Mas o
caminho do ficheiro de configuração é resolvido a partir da **raiz do
repositório**, ignorando a raiz do serviço. Com o config file em `railway.json`
e a raiz em `ops/backup`, a Railway lê o `railway.json` da aplicação web: o
container do backup nasce com `startCommand` de `next start` e com o
pre-deploy de migração, e morre sem log nenhum.

Foi assim que o serviço de backup subiu a correr o Next.js. O sintoma não fala
nada sobre a causa, então fica escrito aqui.

## Como funciona

Cron às 6h UTC — o `cronSchedule` do `railway.json` é `0 6 * * *`, e a Railway
conta em UTC, não no fuso do salão. Em Lisboa isso é **7h no horário de verão e
6h no de inverno**: a hora anda uma vez por ano, e o que está fixo é a de
Greenwich. Cai fora do horário das duas lojas nas duas metades do ano, que é o
que interessa — dump com a receção a lançar comanda é dump de um banco em
movimento.

Sobe, corre o `pg_dump`, comprime, manda para o bucket `backups` do projeto e
sai. Nada fica de pé entre execuções.

Retenção de 30 ficheiros, controlada pela variável `RETENCAO`. O nome do
ficheiro é ISO, então ordem alfabética é ordem cronológica e a poda é só
descartar o fim da lista.

## A prova do restore

Todos os domingos, logo depois do dump, o `verificar.sh` descarrega o ficheiro **do
bucket**, restaura num banco descartável (`restore_check`, criado e apagado
na mesma execução) e conta o que voltou. Se vierem menos de 30 tabelas ou
menos de 2 travas de exclusão, ele falha — as duas travas são as
anti-overbooking, e um restore sem elas passaria por bom a aceitar dois
clientes no mesmo horário.

Descarrega do bucket em vez de reaproveitar o ficheiro local de propósito: a prova precisa de
cobrir o upload e a leitura de volta, não só o `pg_dump`.

O nome do banco de rascunho é constante no código, não variável de ambiente.
Nada configurável decide onde esse script escreve.

Para conferir na hora, sem esperar domingo: `VERIFICAR=sempre`.

**A prova ainda não passou contra o Supabase.** O `verificar.sh` cria um banco
ao lado do de origem (`create database restore_check`) e liga-se a ele; no
pooler do Supabase toda a string termina em `/postgres` e o tenant está amarrado
a um banco só, portanto é provável que falhe ali. Se falhar, o que se perde é a
prova, não o backup: o `backup.sh` faz o dump e o upload **antes** de chamar o
`verificar.sh`, e o ficheiro já está no bucket quando a prova corre. As saídas em
aberto são três — provar num schema descartável em vez de num banco, abrir uma
ligação direta só para esta parte, ou um projeto Supabase de rascunho. Até isto
estar decidido, o serviço está com `VERIFICAR=sempre` de propósito, para que a
primeira execução diga logo o que acontece.

## Variáveis

| Variável | Origem |
| --- | --- |
| `DATABASE_URL` | colada à mão: pooler de **sessão** do Supabase (5432), papel dono |
| `BUCKET` `ENDPOINT` | `${{backups.BUCKET}}` `${{backups.ENDPOINT}}` |
| `AWS_ACCESS_KEY_ID` `AWS_SECRET_ACCESS_KEY` `AWS_DEFAULT_REGION` | bucket `backups` |
| `RETENCAO` | quantos ficheiros guardar (30) |
| `VERIFICAR` | `semanal` (padrão), `sempre` ou `nunca` |

As do bucket vão por referência, que é como uma credencial não passa por
terminal nem por histórico de shell. A do banco **não pode ir** — e é a única
linha desta tabela que exige explicação.

Ela já foi `${{Postgres.DATABASE_URL}}`, quando o banco era o serviço `Postgres`
do mesmo projeto Railway. Deixou de ser: o banco é um Postgres do Supabase
(ADR-009 em `docs/DECISOES.md`), que é outro fornecedor, e não há serviço no
projeto de onde referenciar. Nada em `ops/backup/` aponta para lado nenhum — o
`railway.json` só carrega build e cron, e o `backup.sh` limita-se a exigir que a
variável exista (`: "${DATABASE_URL:?...}"`). Quem escolhe o banco é o valor
posto no painel do serviço, e mais nada.

O valor é o pooler de **sessão** (porta 5432), com o papel dono, e não o de
transação: o `pg_dump` e o `create database` do `verificar.sh` precisam de uma
sessão que sobreviva entre comandos, pelo mesmo motivo que o site tem
`DIRECT_URL` além de `DATABASE_URL`. Multiplexada, a ligação perde a sessão a
meio do trabalho.

## Restaurar

O dump sai sem dono e sem privilégios, então entra em qualquer Postgres 18 —
inclusive fora da Railway. Com as credenciais do bucket no ambiente:

```sh
aws s3 ls s3://$BUCKET/ --endpoint-url $ENDPOINT
aws s3 cp s3://$BUCKET/<ficheiro>.sql.gz . --endpoint-url $ENDPOINT
gunzip -c <ficheiro>.sql.gz | psql "<url-do-banco-destino>"
```

Restaure sempre num banco vazio e descartável primeiro. Restaurar por cima de
produção é a decisão que não tem volta.
