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

/*
  Socket parado é socket que morre sem avisar.

  O `postgres.js` vem com `idle_timeout: null` — uma ligação ociosa fica aberta
  para sempre. Contra um Postgres na mesma sala isso é uma poupança; contra o
  Supavisor do Supabase é a receita de uma avaria calada, e ela aconteceu em
  2026-08-17: o site respondia em 10 ms, o pooler reciclou as ligações do lado
  dele, e a partir daí cada consulta ficou pendurada num socket que já não
  existia. O processo estava vivo, o `/entrar` respondia — só as telas que lêem
  do banco é que penduravam. `select 1` não dava erro: esperava.
  E esperava muito, porque o `connect_timeout` de origem é 30 segundos.

  Nada disto se ganha com pipe aberto: num pooler de *transação* quem multiplexa
  é ele, e a ligação do lado do cliente não guarda estado nenhum entre consultas.
  Segurá-la não poupa trabalho — só acumula sockets à espera de apodrecer.

  `max_lifetime` já vinha do driver (30 a 60 minutos, com folga aleatória para
  as ligações não expirarem todas ao mesmo tempo); o buraco era só o ocioso.
*/
const OCIOSO_S = 20
/** Falhar em 10 s e dizer que falhou vale mais do que pendurar meio minuto. */
const LIGACAO_S = 10

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
    idle_timeout: OCIOSO_S,
    connect_timeout: LIGACAO_S,
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
