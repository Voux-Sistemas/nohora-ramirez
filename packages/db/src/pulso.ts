/**
 * O pulso do banco, quando o site pendura.
 *
 *     npm run db:pulso
 *
 * A radiografia do `inspect` responde "o que é que está guardado". Esta responde
 * outra pergunta, a das noites más: "porque é que a consulta não volta". São
 * coisas diferentes e por isso são dois ficheiros — quem está com o salão em
 * baixo não quer esperar por uma contagem de marcações para saber que há um
 * `idle in transaction` a segurar a tabela toda.
 *
 * Nada aqui escreve. Pode correr contra produção com o site no ar.
 */
import postgres from 'postgres'

/*
  O `.env` só entra se não vier nada de fora, e é de propósito.

  Esta ferramenta existe para apontar ao banco que está a arder, e esse banco
  quase nunca é o do `.env` da máquina de quem depura. `railway run npm run
  db:pulso` injeta a `DATABASE_URL` de produção no processo; se o `.env` local
  fosse carregado sempre, ele apagava-a e o diagnóstico respondia com toda a
  calma sobre o banco errado — que é pior do que não responder.
*/
if (!process.env.DATABASE_URL) await import('./env')

const url = process.env.DATABASE_URL ?? ''
if (!url) throw new Error('DATABASE_URL não definida — veja .env.example')

function ligar(endereco: string) {
  /* O mesmo `prepare: false` do resto do sistema: num pooler de transação o
     statement preparado numa ligação não existe na seguinte. */
  const porta = new URL(endereco).port
  return postgres(endereco, {
    max: 1,
    prepare: porta !== '6543' && porta !== '6432',
    connect_timeout: 15,
    idle_timeout: 5,
  })
}

const sql = ligar(url)

async function secao(titulo: string, consulta: () => Promise<readonly unknown[]>): Promise<void> {
  console.log(`\n── ${titulo} ${'─'.repeat(Math.max(0, 58 - titulo.length))}`)
  try {
    const linhas = await consulta()
    if (linhas.length === 0) console.log('   (nada)')
    else console.table(linhas)
  } catch (erro) {
    console.log('   falhou:', String(erro instanceof Error ? erro.message : erro).slice(0, 400))
  }
}

/*
  As duas portas respondem a perguntas diferentes, e é a diferença entre elas
  que diz onde está a avaria.

  A 6543 é o pooler de transação: entre nós e o Postgres há o Supavisor. A 5432
  é a sessão, quase direta. Se a 5432 responde num piscar e a 6543 é cancelada,
  o Postgres está de saúde e quem está entupido é o pooler — e aí reiniciar a
  aplicação não resolve nada, porque o problema não mora nela.
*/
async function bater(endereco: string, rotulo: string): Promise<void> {
  const p = new URL(endereco).port
  const c = ligar(endereco)
  const t = Date.now()
  try {
    await c`select 1`
    console.log(`   ${rotulo} (porta ${p}): respondeu em ${Date.now() - t} ms`)
  } catch (erro) {
    const m = erro instanceof Error ? erro.message : String(erro)
    console.log(`   ${rotulo} (porta ${p}): FALHOU aos ${Date.now() - t} ms — ${m.slice(0, 160)}`)
  } finally {
    await c.end({ timeout: 5 })
  }
}

async function main(): Promise<void> {
  console.log(`\n── Ida e volta por porta ${'─'.repeat(35)}`)
  await bater(url, 'DATABASE_URL')
  const direta = process.env.DIRECT_URL
  if (direta && direta !== url) await bater(direta, 'DIRECT_URL  ')
  else console.log('   DIRECT_URL: não definida — sem termo de comparação')

  /* `statement_timeout` é o suspeito número um quando até o `select 1` é
     cancelado com o código 57014: se o limite do papel for baixo, qualquer
     espera do lado do servidor vira erro em vez de lentidão. */
  await secao('Limites deste papel', () => sql`
    select current_user as papel,
           current_setting('statement_timeout') as statement_timeout,
           current_setting('idle_in_transaction_session_timeout') as idle_em_transacao,
           current_setting('max_connections') as max_connections
  `)

  await secao('Ligações por estado', () => sql`
    select coalesce(state, '(sem estado)') as estado, count(*)::int as quantas
      from pg_stat_activity
     where datname = current_database()
     group by 1 order by 2 desc
  `)

  /* Uma transação aberta e parada é o que mais faz um site pendurar sem dar
     erro: ela segura o lugar no pooler e os cadeados das tabelas que tocou. */
  await secao('Paradas há mais de 2 s', () => sql`
    select pid,
           state as estado,
           wait_event_type as espera_tipo,
           wait_event as espera,
           round(extract(epoch from (now() - state_change))::numeric, 1) as ha_s,
           left(regexp_replace(coalesce(query, ''), '\s+', ' ', 'g'), 120) as consulta
      from pg_stat_activity
     where datname = current_database()
       and pid <> pg_backend_pid()
       and (state <> 'idle' or state is null)
       and now() - state_change > interval '2 seconds'
     order by state_change
     limit 20
  `)

  await secao('Quem bloqueia quem', () => sql`
    select preso.pid as preso,
           dono.pid as dono,
           left(regexp_replace(coalesce(preso.query, ''), '\s+', ' ', 'g'), 100) as consulta_presa
      from pg_stat_activity preso
      join lateral unnest(pg_blocking_pids(preso.pid)) as b(pid) on true
      join pg_stat_activity dono on dono.pid = b.pid
     limit 20
  `)

  /* Tabela grande que nunca foi analisada faz o planeador escolher varredura
     inteira onde havia índice — a consulta de 3 ms passa a 30 s sem nada ter
     mudado no código. */
  await secao('Tabelas por analisar ou com lixo', () => sql`
    select relname as tabela,
           n_live_tup as vivas,
           n_dead_tup as mortas,
           last_autovacuum as ultimo_vacuum,
           last_analyze as ultima_analise
      from pg_stat_user_tables
     where n_dead_tup > 1000
        or (n_live_tup > 2000 and last_analyze is null and last_autoanalyze is null)
     order by n_dead_tup desc
     limit 10
  `)
}

/*
  Um instantâneo mente sobre uma avaria intermitente.

  O banco que responde em 1 s agora é o mesmo que há dez minutos deixou o
  `select 1` dois minutos preso. Uma fotografia do momento bom conclui "está
  tudo bem" e manda-nos procurar no sítio errado. O que interessa é a curva:
  quantas ligações há, quanto demora a ida e volta, e como as duas coisas se
  mexem juntas enquanto alguém usa o site.

      railway run npm run db:pulso -- --vigiar 20

  Vinte minutos, uma linha a cada trinta segundos. É para deixar a correr num
  terminal enquanto se percorre as telas no outro.
*/
async function vigiar(minutos: number): Promise<void> {
  const fim = Date.now() + minutos * 60_000
  console.log(`a vigiar ${minutos} min — uma linha a cada 30 s\n`)
  console.log('hora      select 1   ligações (activas/ociosas/em transação)   mais antiga')

  while (Date.now() < fim) {
    const t = Date.now()
    let ida = ''
    try {
      await sql`select 1`
      ida = `${Date.now() - t} ms`.padStart(8)
    } catch (erro) {
      ida = 'FALHOU'.padStart(8)
      console.log(`           ${ida}   ${String(erro instanceof Error ? erro.message : erro).slice(0, 90)}`)
    }

    try {
      const [c] = await sql<
        { activas: number; ociosas: number; em_transacao: number; total: number; mais_antiga_s: number | null }[]
      >`
        select count(*) filter (where state = 'active')::int as activas,
               count(*) filter (where state = 'idle')::int as ociosas,
               count(*) filter (where state like 'idle in transaction%')::int as em_transacao,
               count(*)::int as total,
               round(max(extract(epoch from (now() - state_change)))::numeric)::int as mais_antiga_s
          from pg_stat_activity
         where datname = current_database()
           and pid <> pg_backend_pid()
      `
      const hora = new Date().toTimeString().slice(0, 8)
      console.log(
        `${hora}  ${ida}   ${String(c?.activas ?? 0).padStart(3)} act ${String(c?.ociosas ?? 0).padStart(3)} ocio ` +
          `${String(c?.em_transacao ?? 0).padStart(3)} tx  (${c?.total ?? 0} de 60)      ${c?.mais_antiga_s ?? '-'} s`,
      )
    } catch (erro) {
      console.log(`${new Date().toTimeString().slice(0, 8)}  ${ida}   contagem falhou: ${String(erro).slice(0, 80)}`)
    }

    await new Promise((r) => setTimeout(r, 30_000))
  }
}

const pedidoVigiar = process.argv.indexOf('--vigiar')
const rotina = pedidoVigiar >= 0 ? () => vigiar(Number(process.argv[pedidoVigiar + 1]) || 10) : main

rotina()
  .then(() => sql.end())
  .catch(async (erro) => {
    console.error(erro)
    await sql.end()
    process.exitCode = 1
  })
