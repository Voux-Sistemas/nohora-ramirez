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

export async function GET() {
  const inicio = Date.now()
  try {
    /* `select 1` passa pelo pool, pela rede e pelo Postgres — que é tudo o que
       queremos provar. Consulta em tabela nossa acoplaria o health check ao
       schema, e aí uma migração em andamento derrubaria o deploy que a estava
       aplicando. */
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('banco não respondeu a tempo')), LIMITE_MS),
      ),
    ])
    return NextResponse.json({ ok: true, ms: Date.now() - inicio })
  } catch (error) {
    console.error('[saude] banco fora:', String(error))
    return NextResponse.json({ ok: false }, { status: 503 })
  }
}
