/**
 * Freio de segurança para scripts destrutivos.
 *
 * O único que existe hoje é o seed, que trunca o schema inteiro antes de
 * recriar o estúdio fictício. Apontá-lo para o banco do salão por engano —
 * terminal errado, `.env` errado, aba errada — apaga a agenda e o cadastro das
 * clientes de uma vez.
 *
 * A marca mora no banco (`deployment_env`, ver `sql/02_ambiente.sql`) e não em
 * variável de ambiente, porque variável descreve QUEM está rodando e a marca
 * descreve O QUE vai ser apagado. É a segunda que importa aqui.
 *
 * Não existe flag para forçar. Para rodar o seed num banco marcado como
 * produção é preciso apagar a linha na mão — trabalho suficiente para não
 * acontecer sem querer.
 */
import { sql } from 'drizzle-orm'
import type { getDb } from './index'

type Db = ReturnType<typeof getDb>

export async function assertNotProduction(db: Db, operacao: string): Promise<void> {
  const marca = await readEnvMark(db)

  if (marca === 'producao') {
    throw new Error(
      `${operacao} recusado: este banco está marcado como PRODUÇÃO.\n` +
        'Ele contém dados reais de um salão. O seed apagaria tudo.\n' +
        'Se a marca estiver errada, corrija a tabela `deployment_env` antes.',
    )
  }

  if (marca === null) {
    console.warn(
      '⚠ banco sem marca de ambiente. Rode `npm run db:constraints` para criar\n' +
        '  a tabela `deployment_env` e marque produção no dia em que ela nascer.',
    )
  }
}

/** `null` quando a tabela não existe ou está vazia — banco ainda não marcado. */
async function readEnvMark(db: Db): Promise<string | null> {
  const existe = await db.execute<{ existe: boolean }>(sql`
    select to_regclass('public.deployment_env') is not null as existe
  `)
  if (!([...existe][0]?.existe ?? false)) return null

  const linhas = await db.execute<{ kind: string }>(sql`select kind from deployment_env limit 1`)
  return [...linhas][0]?.kind ?? null
}
