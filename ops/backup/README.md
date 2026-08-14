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

Todos os domingos, logo depois do dump, o `verificar.sh` descarrega o ficheiro
**do bucket**, confere que o gzip está inteiro, levanta um Postgres efémero
dentro do próprio contentor, restaura lá e conta o que voltou. Se vierem menos
de 30 tabelas ou menos de 2 travas de exclusão, ele falha — as duas travas são
as anti-overbooking, e um restore sem elas passaria por bom a aceitar dois
clientes no mesmo horário.

Descarrega do bucket em vez de reaproveitar o ficheiro local de propósito: a
prova precisa de cobrir o upload e a leitura de volta, não só o `pg_dump`.

Para conferir na hora, sem esperar domingo: `VERIFICAR=sempre`.

### Porque é que o restore acontece dentro do contentor

Até à migração, o `verificar.sh` fazia `create database restore_check` **no
próprio servidor de produção**, ligado como administrador, e restaurava aí ao
lado do banco vivo. Isso morreu por dois motivos, e o segundo é o importante.

O primeiro é que deixou de correr. O banco passou a ser o Supabase (ADR-009),
onde a aplicação não tem papel para criar bases e onde o pooler amarra a ligação
a um banco só — toda a string termina em `/postgres`. O `create database` não
tinha como funcionar.

O segundo é que nunca devia ter sido assim. Uma prova de backup que precisa de
credencial de administrador do banco vivo, e que cria e destrói bases ao lado
dos dados reais da cliente, é um risco a correr toda a semana para provar uma
coisa que não precisa de tocar em produção nenhuma. Agora não toca: o
`verificar.sh` só lê o ficheiro do bucket, e o destino é um Postgres levantado
com `initdb` em `/tmp`, sem TCP, a atender num socket de ficheiro, que morre com
o contentor. É também por isto que a imagem é a do `postgres` inteiro e não um
cliente solto — o servidor que ela traz é exatamente o que se usa aqui.

Se a prova falhar, o que se perde é a prova, não o backup: o `backup.sh` faz o
dump e o upload **antes** de chamar o `verificar.sh`, e o ficheiro já está no
bucket quando ela corre.

## Variáveis

| Variável | Origem |
| --- | --- |
| `DATABASE_URL` | `${{web.DIRECT_URL}}` — pooler de **sessão** do Supabase (5432) |
| `BUCKET` `ENDPOINT` | `${{backups.BUCKET}}` `${{backups.ENDPOINT}}` |
| `AWS_ACCESS_KEY_ID` `AWS_SECRET_ACCESS_KEY` `AWS_DEFAULT_REGION` | bucket `backups` |
| `RETENCAO` | quantos ficheiros guardar (30) |
| `VERIFICAR` | `semanal` (padrão), `sempre` ou `nunca` |

Tudo por referência, sem uma credencial escrita à mão neste serviço. É assim que
nenhuma delas passa por terminal nem por histórico de shell.

A linha do banco é a que exige explicação. Ela já foi
`${{Postgres.DATABASE_URL}}`, quando o banco era o serviço `Postgres` do mesmo
projeto Railway. Esse serviço deixou de existir: o banco é um Postgres do
Supabase (ADR-009 em `docs/DECISOES.md`), que é outro fornecedor, e não há
serviço de banco no projeto de onde referenciar.

O que há é o `web`, que já precisa da mesma string para correr migrações — é a
`DIRECT_URL` dele. Então o valor real vive **só lá**, e aqui referencia-se.
Colar a credencial nos dois serviços funcionaria igual hoje, e é precisamente
esse o problema: no dia em que a senha do Supabase rodar, um dos dois fica para
trás, e o que fica para trás é o que ninguém vê falhar — o backup corre de
madrugada e ninguém lê o log de um serviço que sempre funcionou. Com a
referência há um sítio só para mudar.

Nada em `ops/backup/` aponta para banco nenhum — o `railway.json` só carrega
build e cron, e o `backup.sh` limita-se a exigir que a variável exista
(`: "${DATABASE_URL:?...}"`). Quem escolhe o banco é o painel do serviço.

O valor referenciado é o pooler de **sessão** (porta 5432), com o papel dono, e
não o de transação: o `pg_dump` precisa de uma ligação que sobreviva entre
comandos, pelo mesmo motivo que o site tem `DIRECT_URL` além de `DATABASE_URL`.
Multiplexada, a ligação perde a sessão a meio do trabalho. O `verificar.sh` já
não usa esta variável — o restore acontece dentro do contentor.

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
