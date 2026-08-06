/*
  Reconcilia o histórico de migrações com um banco que foi construído por `push`.

  O banco de desenvolvimento recebeu as tabelas via `drizzle-kit push`, então a
  migração 0001 — correta para um banco novo — falha aqui dizendo que o tipo já
  existe. Este script aplica o que de fato falta e registra as migrações como
  aplicadas, para que `migrate` volte a ser a fonte de verdade daqui em diante.

  Uso único, em ambiente de desenvolvimento. Não roda em produção.
*/
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { requireEnv } from './env'

const dir = join(process.cwd(), 'migrations')
const journal = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8')) as {
  entries: { tag: string; when: number }[]
}

const sql = postgres(requireEnv('DATABASE_URL'), { max: 1 })

await sql`ALTER TABLE units ADD COLUMN IF NOT EXISTS image_url text`

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`
await sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
  id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint
)`

for (const entry of journal.entries) {
  const hash = createHash('sha256')
    .update(readFileSync(join(dir, `${entry.tag}.sql`), 'utf8'))
    .digest('hex')
  const [row] = await sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`
  if (row) {
    console.log(`· ${entry.tag} já registrada`)
    continue
  }
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`
  console.log(`+ ${entry.tag} registrada`)
}

const [col] = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'units' AND column_name = 'image_url'`
console.log(col ? '+ units.image_url presente' : '! units.image_url AUSENTE')

await sql.end()
