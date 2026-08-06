/**
 * Aplica as constraints que o Drizzle não expressa (EXCLUDE, CHECK,
 * NULLS NOT DISTINCT). Rodar sempre depois das migrations.
 *
 *     npm run db:constraints --workspace=@studio/db
 *
 * O script é idempotente: pode rodar quantas vezes quiser.
 */
import './env'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sql')

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL não definida — veja .env.example')
    process.exit(1)
  }

  const files = (await readdir(sqlDir)).filter((f) => f.endsWith('.sql')).sort()
  if (files.length === 0) {
    console.log('Nenhum arquivo .sql em packages/db/sql')
    return
  }

  const client = postgres(url, { max: 1 })

  try {
    for (const file of files) {
      const statements = await readFile(join(sqlDir, file), 'utf8')
      process.stdout.write(`→ aplicando ${file} … `)
      await client.unsafe(statements)
      console.log('ok')
    }
    console.log('\nConstraints aplicadas.')
  } catch (error) {
    console.error('\nFalhou:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

void main()
