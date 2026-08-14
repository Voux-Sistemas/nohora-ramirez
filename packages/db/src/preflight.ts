/**
 * Confere a `DIRECT_URL` antes de a migration lhe tocar.
 *
 * Corre primeiro no `preDeployCommand` porque a falha que ele apanha é
 * ilegível quando vem do drizzle-kit. Com a URL errada, o deploy morre assim:
 *
 *     PostgresError: permission denied for database postgres
 *     npm error command sh -c drizzle-kit migrate
 *
 * Isso não diz nem qual papel se ligou, nem que existem dois, nem qual devia
 * ser. Já aconteceu: a `DIRECT_URL` foi preenchida a partir da `DATABASE_URL`
 * mudando só a porta, e veio com o papel `app_web` junto — o papel de DML que
 * o ADR-009 criou justamente para o site nunca poder alterar o schema. A porta
 * estava certa e mesmo assim nenhum deploy passava.
 *
 * As duas condições conferidas aqui são as duas maneiras de errar esta
 * variável, e nenhuma delas se vê a olho na string:
 *
 *   1. papel sem CREATE na base — é o `app_web` no lugar do dono;
 *   2. pooler de transação (6543) no lugar do de sessão (5432) — a migration
 *      tira um advisory lock e o pooler devolve cada comando por uma ligação
 *      diferente, portanto o cadeado não tranca nada.
 *
 * Só lê. `has_database_privilege` é uma pergunta ao catálogo, não um teste
 * destrutivo: não cria nem apaga nada para descobrir a resposta.
 */
import './env'
import postgres from 'postgres'
import { urlDireta } from './index'

async function main(): Promise<void> {
  let url: string
  try {
    url = urlDireta()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }

  const porta = (() => {
    try {
      return new URL(url).port
    } catch {
      return ''
    }
  })()

  if (porta === '6543') {
    console.error(
      'DIRECT_URL está no pooler de TRANSAÇÃO (6543).\n' +
        'Migration e constraints precisam do pooler de SESSÃO (5432).\n' +
        'Ver docs/DECISOES.md, ADR-009.',
    )
    process.exit(1)
  }

  const client = postgres(url, { max: 1 })

  try {
    const [row] = await client<{ papel: string; pode: boolean }[]>`
      select current_user as papel,
             has_database_privilege(current_database(), 'CREATE') as pode`

    if (!row?.pode) {
      console.error(
        `DIRECT_URL liga-se como "${row?.papel}", que não pode criar na base.\n` +
          'Migration e constraints correm como o DONO do banco; o papel do site\n' +
          '(app_web) só faz DML, de propósito — ver packages/db/sql/03_app_web_role.sql.\n' +
          'No Supabase: Project Settings → Database → Connection string → Session pooler.',
      )
      process.exit(1)
    }

    console.log(`→ preflight: "${row.papel}" pode migrar (sessão, porta ${porta || '5432'})`)
  } catch (error) {
    console.error('preflight falhou:', error instanceof Error ? error.message : error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

void main()
