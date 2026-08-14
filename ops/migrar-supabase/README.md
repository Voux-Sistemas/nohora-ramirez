# Migração para o Supabase

Serviço de uma execução: copia o banco de produção da Railway para um
Postgres do Supabase. Existe só até o corte acontecer — depois disso pode ser
apagado.

Mesma pegadinha do `ops/backup`: **Root directory** `ops/migrar-supabase` e
**Config file** `ops/migrar-supabase/railway.json`, os dois ajustados no
serviço. O caminho do config é resolvido a partir da raiz do repositório,
ignorando a raiz do serviço — sem os dois certos, a Railway lê o
`railway.json` da aplicação web e o container sobe rodando o Next.js em vez do
script.

## Como funciona

`pg_dump` da origem → `psql` no destino, os dois dentro do mesmo container.
Roda uma vez (`restartPolicyType: NEVER`) e sai — não é cron. Dispara com
`railway up` ou redeploy manual, cada vez que precisar rodar de novo.

## Variáveis

| Variável | Origem |
| --- | --- |
| `ORIGEM` | `${{Postgres.DATABASE_URL}}` — por referência, nunca escrita à mão |
| `DESTINO` | pooler de **sessão** do Supabase (porta 5432), colado manualmente uma vez — o Supabase não é um recurso da Railway, não tem referência |

## Uso

1. **Ensaio primeiro**, contra um projeto Supabase de teste — nunca contra o
   destino final na primeira vez.
2. Conferir o log: `TABELAS` ≥ 30, `TRAVAS` = 2. O script já falha sozinho se
   não bater, mas vale olhar o log inteiro por avisos do `psql` que não
   interrompem a execução.
3. Só depois, rodar contra o destino real, com o site ainda a apontar para a
   Railway — a cópia não afeta quem está a servir tráfego.
4. Trocar `DATABASE_URL`/`DIRECT_URL` do serviço `web` e fazer o redeploy.
5. Apagar este serviço. Não tem função depois do corte.

## Restaurar (se algo correr mal no ensaio)

`DESTINO` tem de estar vazio antes de rodar. Para limpar um projeto Supabase
de teste entre tentativas, pelo editor de SQL do Supabase:

```sql
drop schema public cascade;
create schema public;
```
