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
  O que aconteceu em 2026-08-17, e porque é que estes três números existem.

  O site respondia em 10 ms e, sem nada mudar, todas as telas que lêem do banco
  passaram a girar para sempre. O processo estava vivo e o `/entrar` respondia,
  porque essa tela não pergunta nada ao Postgres. O log não dizia nada: um
  pedido pendurado não escreve linha nenhuma. E o banco, visto de fora, estava
  de perfeita saúde — `select 1` em 1,2 s pelo mesmo pooler, à mesma hora.

  A avaria era o pool a esvaziar-se. Uma consulta que fica presa só devolve a
  ligação quando acaba, e o limite de origem do Supabase para acabar à força é
  `statement_timeout = 2min`. Dez ligações presas, dois minutos cada, e o site
  não tem mais nenhuma para dar a quem chega: quem estava a marcar viu a roda a
  girar até desistir. Reiniciar curava por vinte minutos, que é o tempo de
  voltar a encher o pool de consultas presas.

  O remate está no papel `app_web` (`sql/03_app_web_role.sql`): dez segundos de
  `statement_timeout` em vez de dois minutos. O que fica aqui é o lado do
  cliente da mesma ideia — nenhum destes números torna o site mais rápido, todos
  o fazem falhar depressa em vez de pendurar, que é a diferença entre uma tela
  que se recarrega e um servidor que se reinicia.
*/

/*
  Ocioso: o `postgres.js` vem com `idle_timeout: null` e segura a ligação para
  sempre. Contra um pooler de *transação* isso não poupa nada — quem multiplexa
  é ele, e a ligação do cliente não guarda estado entre consultas —, só acumula
  sockets à espera de apodrecer do lado de lá. Dois minutos larga o que está
  parado sem transformar cada visita num aperto de mão TLS novo.
*/
const OCIOSO_S = 120

/** Falhar em 10 s e dizer que falhou vale mais do que pendurar meio minuto. */
const LIGACAO_S = 10

/*
  Vida máxima: o driver traz 30 a 60 minutos. Meia hora é muito tempo para uma
  ligação que o pooler do outro lado já pode ter reciclado sem nos avisar.
  Dez minutos, com a mesma folga aleatória do driver para as ligações não
  expirarem todas no mesmo segundo e deixarem o site sem nenhuma.
*/
const VIDA_S = 600 + Math.floor(Math.random() * 300)

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
    max_lifetime: VIDA_S,
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
