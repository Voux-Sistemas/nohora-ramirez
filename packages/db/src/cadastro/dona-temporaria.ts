/**
 * Uma conta de dona (papel `owner`, `unitId` nulo = enxerga tudo) só para
 * testar a área de gestão, enquanto a conta real da cliente não é criada.
 *
 *     npm run dona-temporaria --workspace=@studio/db
 *
 * PROVISÓRIO DE PROPÓSITO — mesma lógica do `equipe-temporaria.ts`. A porta
 * de instalação (`/comecar`) só cria a primeira conta enquanto não existe
 * nenhum papel de equipe no banco; como o `equipe-temporaria.ts` já criou
 * profissionais fictícios, essa porta fechou sozinha. Este script é o jeito
 * de abrir uma conta de gestão sem passar por ali. Quando a dona de verdade
 * tiver conta própria, apaga-se esta.
 *
 * Mesma trava dos outros scripts de cadastro: só acrescenta, nunca reescreve
 * o que já existe — rodar de novo depois não faz nada.
 *
 * ONDE CORRER — mesma regra dos outros, não há proxy até o Postgres de
 * produção:
 *
 *     railway ssh --service web
 *     npm run dona-temporaria --workspace=@studio/db
 */

import '../env'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq, isNull } from 'drizzle-orm'
import { closeDb, getDb, type Database } from '../index'
import { userRoles, users } from '../schema/index'

const scryptAsync = promisify(scrypt)

/** Mesmo formato `salt:hash` de `apps/web/src/server/auth/crypto.ts` — não dá
 * para importar aquele módulo `server-only` daqui, então repete-se o algoritmo. */
async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(plain, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

const SENHA_TESTE = 'dona-teste-2026'
const NOME = 'Dona (temporário)'
/* Mesma faixa +351 900 00000x do equipe-temporaria.ts — 900 é tarifa
   especial, não celular, então não colide com número real. Próximo da fila. */
const TELEFONE = '+351900000003'

async function main(): Promise<void> {
  const db = getDb({ max: 1 })
  try {
    const [existente] = await db.select({ id: users.id }).from(users).where(eq(users.phone, TELEFONE)).limit(1)

    let userId: string
    if (existente) {
      userId = existente.id
      console.log(`${NOME}: já existia`)
    } else {
      const passwordHash = await hashSecret(SENHA_TESTE)
      const [criado] = await db
        .insert(users)
        .values({ phone: TELEFONE, name: NOME, passwordHash, status: 'active' })
        .returning({ id: users.id })
      userId = criado!.id
      console.log(`${NOME}: criado (telefone ${TELEFONE})`)
    }

    await garantirPapelDeDona(db, userId)

    console.log(
      `\nConcluído. Login em /entrar — telefone ${TELEFONE}, senha "${SENHA_TESTE}". ` +
        'Conta marcada "(temporário)" — trocar pela conta real da dona assim que ela existir.',
    )
  } finally {
    await closeDb()
  }
}

async function garantirPapelDeDona(db: Database, userId: string): Promise<void> {
  const [papel] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.unitId), eq(userRoles.role, 'owner')))
    .limit(1)
  if (papel) {
    console.log('papel de dona: já existia')
    return
  }
  await db.insert(userRoles).values({ userId, unitId: null, role: 'owner' })
  console.log('papel de dona: criado')
}

void main().catch((erro) => {
  console.error('\nFalhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
