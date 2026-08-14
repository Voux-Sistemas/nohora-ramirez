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
import { urlDireta } from './index'

const sqlDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'sql')

/**
 * Grava em `deployment_env` que banco é este, a partir do AMBIENTE do processo
 * que está rodando o deploy. Assim a marca nasce junto com o banco, sem
 * ninguém precisar lembrar de rodar um SQL à mão no dia do go-live — e sem
 * expor o Postgres de produção para fora da rede da Railway só para isso.
 *
 * Nunca rebaixa produção para teste. Um `AMBIENTE=teste` apontado por engano
 * para o banco do salão desarmaria a trava do seed, que é exatamente o
 * acidente que ela existe para impedir. Promover é automático; rebaixar exige
 * editar a linha na mão.
 */
async function marcarAmbiente(client: postgres.Sql): Promise<void> {
  const declarado = process.env.AMBIENTE
  if (declarado !== 'producao' && declarado !== 'teste') return

  const [atual] = await client<{ kind: string }[]>`select kind from deployment_env limit 1`
  if (atual?.kind === 'producao' && declarado === 'teste') {
    console.log('→ ambiente: banco marcado como produção, AMBIENTE=teste ignorado')
    return
  }
  if (atual?.kind === declarado) return

  await client`
    insert into deployment_env (kind) values (${declarado})
    on conflict (singleton) do update set kind = excluded.kind, marked_at = now()
  `
  console.log(`→ ambiente: banco marcado como ${declarado}`)
}

/**
 * Confere que as travas anti-overbooking existem mesmo, depois de aplicadas.
 *
 * Não é paranoia: o `EXCLUDE USING gist` depende do btree_gist estar
 * alcançável pelo search_path, e num banco gerenciado ele mora num schema à
 * parte. O modo de falha ruim não é o comando dar erro — é a constraint não
 * nascer e o deploy seguir verde, com o salão a marcar duas clientes na mesma
 * cadeira até alguém reparar no balcão.
 *
 * Barato de conferir, caro de descobrir tarde. Fica aqui.
 */
async function conferirTravas(client: postgres.Sql): Promise<void> {
  const esperadas = [
    'appointment_staff_blocks_no_overlap',
    'appointment_resource_blocks_no_overlap',
  ]

  const achadas = await client<{ conname: string }[]>`
    select conname from pg_constraint
    where contype = 'x' and conname = any(${esperadas})
  `
  const faltando = esperadas.filter((nome) => !achadas.some((r) => r.conname === nome))

  if (faltando.length > 0) {
    throw new Error(
      `trava anti-overbooking ausente: ${faltando.join(', ')}. ` +
        'O btree_gist provavelmente não está no search_path deste banco.',
    )
  }
  console.log(`→ travas anti-overbooking: ${esperadas.length} confirmadas`)
}

async function main(): Promise<void> {
  /* DDL pede sessão, não pooler de transação — o mesmo motivo do
     drizzle.config.ts. `urlDireta` cai no DATABASE_URL quando não há as duas. */
  let url: string
  try {
    url = urlDireta()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
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
    await conferirTravas(client)
    await marcarAmbiente(client)
    console.log('\nConstraints aplicadas.')
  } catch (error) {
    console.error('\nFalhou:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

void main()
