import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

export * from './schema/index'
export { schema }

/*
  O pool mora no `globalThis`, não no escopo do módulo.

  O HMR do Next reavalia este módulo a cada recompilação, e um pool em `let`
  nasce de novo junto — dez conexões novas por salvamento, nenhuma das antigas
  fechada. Depois de algumas dezenas de edições o Postgres responde "sorry, too
  many clients already" e o servidor de dev cai em 500. `globalThis` sobrevive
  à troca de módulo, então o pool continua sendo um só.
*/
const POOL = Symbol.for('@studio/db.pool')
type PoolHolder = { [POOL]?: ReturnType<typeof postgres> }

function connectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL não definida — veja .env.example')
  return url
}

/**
 * Conexão única e preguiçosa. `max: 1` no worker e em scripts evita estourar
 * o limite de conexões do Postgres gerenciado.
 */
export function getDb(options?: { max?: number }) {
  const holder = globalThis as PoolHolder
  holder[POOL] ??= postgres(connectionString(), {
    max: options?.max ?? 10,
    // o Postgres devolve timestamptz; deixamos o driver entregar Date em UTC
    transform: { undefined: null },
  })
  return drizzle(holder[POOL], { schema })
}

export type Database = ReturnType<typeof getDb>

export async function closeDb(): Promise<void> {
  const holder = globalThis as PoolHolder
  if (holder[POOL]) {
    await holder[POOL].end()
    delete holder[POOL]
  }
}
