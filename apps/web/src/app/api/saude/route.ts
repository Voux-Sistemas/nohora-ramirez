import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * O sinal de vida que o Railway lê antes de mandar cliente para a versão nova.
 *
 * Sem isto, o deploy troca a versão no ar assim que o processo sobe — e um
 * processo sobe muito antes de conseguir responder. Uma migração que falhou
 * pela metade, uma variável de ambiente errada ou o Postgres ainda reiniciando
 * viravam agenda fora do ar até alguém perceber e mandar voltar.
 *
 * **Ele fala com o banco de propósito.** "O Node está de pé" não é saúde
 * nenhuma: a agenda, o caixa e o login são todos leitura de Postgres. Um
 * container feliz e sem banco é exatamente o estado que precisa reprovar.
 *
 * Não diz mais do que precisa. Versão, host e nome de banco numa rota pública
 * são reconhecimento de graça para quem estiver procurando o que atacar.
 */

export const dynamic = 'force-dynamic'

const LIMITE_MS = 4000

/**
 * Um `Promise.race` responde depressa e deita fora a resposta lenta.
 *
 * Isso aqui custou caro. Quando o banco pendurou a sério, o log só dizia
 * "banco não respondeu a tempo" — a frase do nosso próprio cronómetro, que não
 * sabe nada. O erro do Postgres chegava um minuto e meio depois, ao lado
 * nenhum: a promessa perdedora já não tinha quem a ouvisse, e o Node ainda a
 * anunciava como `unhandledRejection` no meio do log.
 *
 * O erro verdadeiro (`57014: canceling statement due to statement timeout`)
 * era a diferença entre procurar no sítio certo e procurar a noite toda.
 * Então a corrida continua a decidir a resposta, mas a promessa lenta fica com
 * alguém a ouvi-la: chegue quando chegar, o motivo vai para o log.
 */
export async function GET() {
  const inicio = Date.now()

  /* `select 1` passa pelo pool, pela rede e pelo Postgres — que é tudo o que
     queremos provar. Consulta em tabela nossa acoplaria o health check ao
     schema, e aí uma migração em andamento derrubaria o deploy que a estava
     aplicando. */
  const consulta = db.execute(sql`select 1`)

  let respondeu = false
  consulta.then(
    () => {
      respondeu = true
    },
    (erro: unknown) => {
      respondeu = true
      console.error(`[saude] o banco recusou aos ${Date.now() - inicio} ms:`, detalhe(erro))
    },
  )

  try {
    await Promise.race([
      consulta,
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('sem resposta')), LIMITE_MS)),
    ])
    return NextResponse.json({ ok: true, ms: Date.now() - inicio })
  } catch {
    if (!respondeu) {
      console.error(`[saude] o banco não respondeu em ${LIMITE_MS} ms — o motivo real fica para quando chegar`)
    }
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}

/** O código do Postgres é o que se procura no manual; a mensagem sozinha não. */
function detalhe(erro: unknown): string {
  if (!(erro instanceof Error)) return String(erro)
  const codigo = (erro as { code?: string }).code
  const causa = erro.cause instanceof Error ? ` ← ${erro.cause.message}` : ''
  return `${codigo ? `[${codigo}] ` : ''}${erro.message}${causa}`
}
