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
 * A ligação para DDL: migrations, constraints e seed.
 *
 * Um pooler de transação não serve para isso. Ele não guarda estado entre
 * comandos, e o `drizzle-kit migrate` depende de um advisory lock — o cadeado
 * que impede duas instâncias de aplicarem a mesma migration ao mesmo tempo.
 * Cadeado tirado numa conexão e devolvido noutra não tranca nada.
 *
 * Sem `DIRECT_URL` cai no `DATABASE_URL`, que é o caso de um Postgres simples
 * em desenvolvimento: lá as duas coisas são o mesmo endereço.
 */
export function urlDireta(): string {
  return process.env.DIRECT_URL || connectionString()
}

/*
  `prepare: false` no pooler de transação não é afinação, é obrigatório.

  O `postgres.js` usa prepared statements nomeados por padrão. Num pooler de
  transação (Supavisor na 6543, PgBouncer na 6432) cada transação pode cair num
  backend diferente do servidor: o statement preparado numa conexão não existe
  na seguinte, e o Postgres responde `prepared statement "s1" does not exist`.

  A falha só aparece sob concorrência, de forma intermitente, com cara de bug
  aleatório do sistema — o pior tipo de defeito para diagnosticar meses depois.
  Por isso a decisão sai da porta da URL em vez de morar numa variável que
  alguém precisa lembrar de ligar no dia da migração.
*/
const PORTAS_DE_POOLER = new Set(['6543', '6432'])

function ehPoolerDeTransacao(url: string): boolean {
  try {
    return PORTAS_DE_POOLER.has(new URL(url).port)
  } catch {
    return false
  }
}

/**
 * Conexão única e preguiçosa. `max: 1` no worker e em scripts evita estourar
 * o limite de conexões do Postgres gerenciado.
 */
export function getDb(options?: { max?: number }) {
  const holder = globalThis as PoolHolder
  const url = connectionString()
  holder[POOL] ??= postgres(url, {
    max: options?.max ?? 10,
    prepare: !ehPoolerDeTransacao(url),
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
