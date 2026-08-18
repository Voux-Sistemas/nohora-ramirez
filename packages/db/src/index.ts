import net from 'node:net'
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

/** Qualquer pooler, de transação ou de sessão — o da Supabase anuncia-se no nome. */
function ehPooler(url: string): boolean {
  try {
    return ehPoolerDeTransacao(url) || new URL(url).hostname.includes('.pooler.')
  } catch {
    return false
  }
}

/*
  O pooler de TRANSAÇÃO não serve para este site, e a prova está medida.

  O `postgres.js` não espera a resposta de uma consulta para mandar a seguinte
  pela mesma ligação — chama-se pipelining e é o que o torna rápido. Quando o
  pool está todo ocupado, a consulta que sobra não fica à espera de uma ligação
  livre: viaja colada a uma que já está a trabalhar.

  Contra o Supavisor da 6543 isso não funciona. Medido a 2026-08-18 contra a
  base de produção, oito consultas triviais lançadas de uma vez numa ligação:
  **duas respondem, as outras seis nunca respondem**. Não dão erro, não expiram,
  ficam pendentes para sempre. As mesmas oito, pelas mesmas credenciais, na
  porta de sessão 5432: 8/8 em 1,5 s.

  É a avaria que pendurou o site duas vezes, e a que deixou o `/agendar/valongo`
  a girar sem nunca responder: a tela que monta a agenda pergunta quinze coisas
  ao banco em três vagas, passa dos dez da piscina, e a partir daí há sempre
  consultas encavalitadas. Nada do lado do banco a pode salvar — o Postgres nem
  chega a receber a pergunta, portanto o `statement_timeout` de dez segundos do
  papel `app_web` não tem o que cortar. Do lado do cliente, o relógio do socket
  também não arma: as respostas das consultas vizinhas chegam pelo mesmo fio e
  reiniciam-lhe a contagem.

  Por isso a porta de transação é corrigida aqui em vez de ser respeitada. Uma
  aplicação Node com pool de ligações longas é exactamente o caso para que a
  Supabase publica a porta de sessão; a 6543 é para funções efémeras, que abrem
  e fecham uma ligação por pedido e nunca encavalitam nada. A troca é anunciada
  no arranque, e não feita em silêncio: quem lê o log vê que a URL que deu não
  é a URL que está a ser usada, e corrige a variável na origem.
*/
const PORTA_DE_SESSAO = '5432'

function urlDaAplicacao(): string {
  const bruta = connectionString()
  if (!ehPoolerDeTransacao(bruta)) return bruta

  const url = new URL(bruta)
  const antes = url.port
  url.port = PORTA_DE_SESSAO
  console.warn(
    `[db] DATABASE_URL aponta para o pooler de transação (porta ${antes}), que perde ` +
      `consultas em paralelo. A usar a porta de sessão ${PORTA_DE_SESSAO} em ${url.hostname}. ` +
      'Corrija a variável na origem.',
  )
  return url.toString()
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
  sempre, e o outro extremo — largar depressa — sai caro neste sítio. Abrir uma
  ligação nova custa 1,2 s medidos (TCP + TLS + autenticação até eu-central-1),
  e uma tela que pergunta treze coisas ao banco abre dez ligações de uma vez:
  com a piscina fria são 1,4 s só de apertos de mão, com ela quente são 0,4 s.
  Num salão de bairro passam minutos entre duas visitas, portanto um prazo curto
  garante que quase toda a cliente paga o aperto de mão outra vez.

  Dez minutos. Na porta de *sessão* cada ligação nossa segura uma ligação do
  servidor, por isso não se pode segurar para sempre — mas dez das sessenta que
  a base tem, guardadas dez minutos, é troca justa por não pôr um segundo em
  cima de cada primeira tela.
*/
const OCIOSO_S = 600

/** Falhar em 10 s e dizer que falhou vale mais do que pendurar meio minuto. */
const LIGACAO_S = 10

/*
  Vida máxima: o driver traz 30 a 60 minutos. Os dez minutos que aqui estiveram
  eram medo do pooler de *transação*, que podia reciclar o backend por baixo de
  nós sem avisar. Na porta de sessão a ligação é nossa do princípio ao fim, e
  reciclá-la de dez em dez minutos era só voltar a pagar o aperto de mão de 1,2 s
  a meio da tarde. Meia hora, com a mesma folga aleatória do driver para as
  ligações não expirarem todas no mesmo segundo e deixarem o site sem nenhuma.
*/
const VIDA_S = 1_800 + Math.floor(Math.random() * 600)

/*
  O quarto número é do nosso lado do fio, e é o que faltava.

  Os três de cima tratam de ligações paradas, lentas a nascer e velhas demais.
  Nenhum trata do caso que nos derrubou a seguir, no mesmo dia: a ligação está
  aberta, a pergunta saiu, e a resposta não chega nunca. Do lado do banco isso
  aparece como `wait_event: ClientRead` — o servidor à espera do cliente —, e é
  por isso que o `statement_timeout` de dez segundos do papel `app_web` não
  dispara: o Postgres não está a executar nada, está à escuta. O `postgres.js`
  3.4 também não tem prazo nenhum para uma resposta: a promessa da consulta fica
  pendente para sempre, a ligação nunca volta ao pool, e ao fim de dez pedidos o
  site está pendurado outra vez. Foi assim que uma ligação sozinha ficou 448
  segundos a segurar um `select` da tabela `units`.

  A causa desse silêncio só apareceu no dia seguinte, e está escrita mais acima:
  era o pooler de transação a engolir as consultas encavalitadas. Tratada a
  causa, este relógio deixa de ser o que segura o site de pé — passa a ser o que
  costuma ser um prazo, a rede de quem já não conta cair.

  O prazo tem de ser nosso e tem de estar no socket, porque o socket é a única
  peça que ninguém está a vigiar. Damos a tomada ao driver já ligada e deixamos
  lá um relógio: de dois em dois segundos compara os contadores do próprio
  socket. Se escrevemos alguma coisa e não voltou um único byte durante vinte e
  cinco segundos, a linha está morta e deitamos o socket fora. Aí o `postgres.js`
  faz o que sabe fazer sozinho — rejeita a consulta pendente, fecha e volta a
  ligar. A tela dá erro e recarrega-se; o pool não se esvazia.

  Vinte e cinco segundos é escolhido para ficar acima de qualquer resposta
  legítima: o `app_web` corta qualquer consulta aos dez, portanto um banco
  saudável responde sempre muito antes — nem que seja para dizer que expirou.

  O limite honesto disto: os contadores dizem quantos bytes passaram, não por
  que ordem. Se uma pergunta sair no mesmo intervalo de dois segundos em que
  chegou a resposta da anterior, o relógio lê «veio resposta» e não arma — é o
  caso de duas consultas coladas na mesma ligação. A avaria que tivemos era a
  outra, a ligação tirada do pool depois de parada, e essa fica coberta. Contar
  ao contrário, armando na dúvida, mataria as ligações paradas de propósito, que
  neste site são a esmagadora maioria.
*/
const PASSO_MS = 2_000
const SILENCIO_MS = 25_000

/*
  `socket` é opção oficial do `postgres.js` desde a 3.x, mas não está nos tipos
  publicados — o `types/index.d.ts` só fala do socket unix. O molde abaixo é a
  declaração que falta, não um contorno ao verificador.

  Duas consequências de entregar a tomada já ligada, ambas aceites: o driver
  deixa de rodar entre vários `host` da URL (a nossa tem um só), e o
  `connect_timeout` dele só arranca depois desta promessa resolver — por isso a
  ligação leva prazo próprio aqui dentro.
*/
type DestinoDaTomada = { host: string[]; port: number[] }
type TomadaDoDriver = net.Socket & { host?: string; port?: number }
type OpcoesComTomada = postgres.Options<Record<string, postgres.PostgresType>> & {
  socket: (opcoes: DestinoDaTomada) => Promise<net.Socket>
}

function tomadaComPrazo(opcoes: DestinoDaTomada): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const [host] = opcoes.host
    const [port] = opcoes.port
    if (host === undefined || port === undefined) {
      reject(new Error('DATABASE_URL sem servidor de banco'))
      return
    }

    const tomada: TomadaDoDriver = net.connect({ host, port })
    /* O driver lê isto para o `servername` do TLS. É ele que costuma pôr, mas
       quem liga a tomada aqui somos nós. */
    tomada.host = host
    tomada.port = port
    tomada.setNoDelay(true)

    const prazoDeLigar = setTimeout(() => {
      tomada.destroy(new Error(`sem ligação ao banco em ${LIGACAO_S}s`))
    }, LIGACAO_S * 1000)

    const falhou = (erro: Error) => {
      clearTimeout(prazoDeLigar)
      reject(erro)
    }
    tomada.once('error', falhou)
    tomada.once('connect', () => {
      clearTimeout(prazoDeLigar)
      tomada.removeListener('error', falhou)
      vigiarSilencio(tomada)
      resolve(tomada)
    })
  })
}

/**
 * O relógio que fica com o socket até ao fim dele.
 *
 * Vive de contadores, e não de eventos, de propósito: quando o driver sobe a
 * ligação para TLS chama `removeAllListeners()` na tomada crua e passa a falar
 * pelo embrulho, de modo que qualquer `on('data')` nosso desaparecia ali. Os
 * `bytesRead`/`bytesWritten` da tomada continuam a contar por baixo do TLS.
 *
 * `unref()` porque um relógio destes, sozinho, segurava o processo de pé.
 */
function vigiarSilencio(tomada: net.Socket): void {
  let lidos = tomada.bytesRead
  /* Marca de água: quanto tínhamos escrito da última vez que nos responderam.
     Enquanto o escrito passar disto, há pergunta à espera de resposta. */
  let escritos = tomada.bytesWritten
  let calado = 0

  const ronda = setInterval(() => {
    if (tomada.destroyed) {
      clearInterval(ronda)
      return
    }

    if (tomada.bytesRead !== lidos) {
      lidos = tomada.bytesRead
      escritos = tomada.bytesWritten
      calado = 0
      return
    }

    if (tomada.bytesWritten === escritos) return // linha parada, nada por responder

    calado += PASSO_MS
    if (calado < SILENCIO_MS) return

    clearInterval(ronda)
    tomada.destroy(new Error(`o banco não respondeu em ${SILENCIO_MS / 1000}s`))
  }, PASSO_MS)

  ronda.unref()
}

/**
 * Conexão única e preguiçosa. `max: 1` no worker e em scripts evita estourar
 * o limite de conexões do Postgres gerenciado.
 */
export function getDb(options?: { max?: number }) {
  const holder = globalThis as PoolHolder
  /* A URL só se resolve quando há piscina para abrir — `urlDaAplicacao` avisa no
     log quando corrige a porta, e esse aviso é para sair uma vez por processo,
     não uma vez por módulo que importe o banco. */
  if (!holder[POOL]) {
    const url = urlDaAplicacao()
    const opcoes: OpcoesComTomada = {
      max: options?.max ?? 10,
      /* Na porta de sessão o statement preparado sobrevive à ligação e podia
         ficar ligado. Fica desligado à mesma: quem multiplexa do outro lado é o
         mesmo Supavisor, e o que se poupa — uma análise de SQL por consulta
         repetida — não se vê ao lado dos 190 ms de ida e volta até
         eu-central-1. Não vale um modo de falha intermitente a mais. */
      prepare: !ehPooler(url),
      idle_timeout: OCIOSO_S,
      connect_timeout: LIGACAO_S,
      max_lifetime: VIDA_S,
      // o Postgres devolve timestamptz; deixamos o driver entregar Date em UTC
      transform: { undefined: null },
      socket: tomadaComPrazo,
    }
    holder[POOL] = postgres(url, opcoes)
  }
  const piscina = holder[POOL]
  if (!piscina) throw new Error('piscina de ligações não abriu')
  return drizzle(piscina, { schema })
}

export type Database = ReturnType<typeof getDb>

export async function closeDb(): Promise<void> {
  const holder = globalThis as PoolHolder
  if (holder[POOL]) {
    await holder[POOL].end()
    delete holder[POOL]
  }
}
