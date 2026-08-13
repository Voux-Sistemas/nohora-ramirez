/**
 * Um profissional fictício por loja, para o agendamento sair do "esta unidade
 * ainda não tem serviços liberados" antes de a equipe real estar cadastrada.
 *
 *     npm run equipe-temporaria --workspace=@studio/db
 *
 * PROVISÓRIO DE PROPÓSITO. Um serviço só aparece pra cliente marcar se algum
 * profissional daquela loja souber fazê-lo (`staff_skills`) — sem ninguém
 * cadastrado, toda loja trava ali. Este script cria um "profissional gen érico"
 * por loja, que sabe fazer tudo o que está no preçário, mais um horário de
 * funcionamento e uma escala de trabalho seg-sáb, só para existir slot pra
 * marcar. Quando a dona mandar a equipe e os horários reais, isso se apaga e se
 * substitui pelo cadastro de verdade em /admin/equipe — não é para conviver com
 * dado real.
 *
 * Mesma trava do `cadastro.ts`: só acrescenta, nunca reescreve o que já existe,
 * então correr de novo depois de a equipe real estar cadastrada não faz nada
 * (os profissionais fictícios ficam intactos até alguém apagá-los à mão).
 *
 * ONDE CORRER — mesma regra do `cadastro.ts`, não há proxy até o Postgres de
 * produção:
 *
 *     railway ssh --service web
 *     npm run equipe-temporaria --workspace=@studio/db
 */

import '../env'
import { randomBytes, scrypt } from 'node:crypto'
import { promisify } from 'node:util'
import { and, eq } from 'drizzle-orm'
import { closeDb, getDb, type Database } from '../index'
import {
  organizations,
  services,
  staffProfiles,
  staffSchedules,
  staffSkills,
  staffUnits,
  unitHours,
  units,
  userRoles,
  users,
} from '../schema/index'

const scryptAsync = promisify(scrypt)

/** Mesmo formato `salt:hash` de `apps/web/src/server/auth/crypto.ts` — não dá
 * para importar aquele módulo `server-only` daqui, então repete-se o algoritmo. */
async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(plain, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

/** Senha de teste — a mesma para os dois, é gente fictícia. */
const SENHA_TESTE = 'equipe-teste-2026'

interface Placeholder {
  slug: string
  nome: string
  telefone: string
}

/*
  Faixa +351 900 00000x: fora de qualquer faixa de operadora móvel real em
  Portugal (900 é serviço de tarifa especial, não celular), então não colide
  com um número de cliente ou de equipe de verdade por acidente.
*/
const PLACEHOLDERS: readonly Placeholder[] = [
  { slug: 'valongo', nome: 'Profissional Valongo (temporário)', telefone: '+351900000001' },
  { slug: 'maia', nome: 'Profissional Maia (temporário)', telefone: '+351900000002' },
]

/** Segunda a sábado, 9h–19h. Fecha domingo. Ajusta quando o horário real chegar. */
const DIAS_UTEIS = [1, 2, 3, 4, 5, 6]
const ABRE = '09:00'
const FECHA = '19:00'

async function main(): Promise<void> {
  const db = getDb({ max: 1 })
  try {
    const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1)
    if (!org) throw new Error('nenhuma organização cadastrada — rode `npm run cadastro` primeiro')

    const catalogo = await db
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.organizationId, org.id), eq(services.active, true)))
    if (catalogo.length === 0) throw new Error('nenhum serviço cadastrado — rode `npm run cadastro` primeiro')
    const servicoIds = catalogo.map((s) => s.id)

    for (const placeholder of PLACEHOLDERS) {
      const [unidade] = await db
        .select({ id: units.id })
        .from(units)
        .where(and(eq(units.organizationId, org.id), eq(units.slug, placeholder.slug)))
        .limit(1)
      if (!unidade) {
        console.log(`→ loja "${placeholder.slug}": não encontrada, pulei`)
        continue
      }

      console.log(`\n→ loja "${placeholder.slug}"`)
      await garantirHorarioLoja(db, unidade.id)
      await garantirProfissional(db, unidade.id, placeholder, servicoIds)
    }

    console.log(
      `\nConcluído. Login de teste: telefone da loja + senha "${SENHA_TESTE}". ` +
        'Dados marcados "(temporário)" — trocar pelo cadastro real da equipe assim que chegar.',
    )
  } finally {
    await closeDb()
  }
}

async function garantirHorarioLoja(db: Database, unitId: string): Promise<void> {
  const existentes = await db.select({ id: unitHours.id }).from(unitHours).where(eq(unitHours.unitId, unitId))
  if (existentes.length > 0) {
    console.log('   horário de funcionamento: já existia')
    return
  }
  await db
    .insert(unitHours)
    .values(DIAS_UTEIS.map((weekday) => ({ unitId, weekday, opensAt: ABRE, closesAt: FECHA })))
  console.log('   horário de funcionamento: seg-sáb 09:00-19:00 criado')
}

async function garantirProfissional(
  db: Database,
  unitId: string,
  placeholder: Placeholder,
  servicoIds: string[],
): Promise<void> {
  const [existente] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.phone, placeholder.telefone))
    .limit(1)

  let userId: string
  if (existente) {
    userId = existente.id
    console.log(`   ${placeholder.nome}: já existia`)
  } else {
    const passwordHash = await hashSecret(SENHA_TESTE)
    const [criado] = await db
      .insert(users)
      .values({ phone: placeholder.telefone, name: placeholder.nome, passwordHash, status: 'active' })
      .returning({ id: users.id })
    userId = criado!.id
    console.log(`   ${placeholder.nome}: criado (telefone ${placeholder.telefone})`)
  }

  const [papel] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.unitId, unitId), eq(userRoles.role, 'professional')))
    .limit(1)
  if (!papel) await db.insert(userRoles).values({ userId, unitId, role: 'professional' })

  let staffId: string
  const [perfil] = await db.select({ id: staffProfiles.id }).from(staffProfiles).where(eq(staffProfiles.userId, userId)).limit(1)
  if (perfil) {
    staffId = perfil.id
  } else {
    const [criado] = await db
      .insert(staffProfiles)
      .values({ userId, displayName: placeholder.nome, acceptsOnlineBooking: true, active: true })
      .returning({ id: staffProfiles.id })
    staffId = criado!.id
  }

  const [vinculo] = await db
    .select({ id: staffUnits.id })
    .from(staffUnits)
    .where(and(eq(staffUnits.staffId, staffId), eq(staffUnits.unitId, unitId)))
    .limit(1)
  if (!vinculo) await db.insert(staffUnits).values({ staffId, unitId, isPrimary: true })

  const jaSabe = new Set(
    (await db.select({ serviceId: staffSkills.serviceId }).from(staffSkills).where(eq(staffSkills.staffId, staffId))).map(
      (r) => r.serviceId,
    ),
  )
  const faltando = servicoIds.filter((id) => !jaSabe.has(id))
  if (faltando.length > 0) {
    await db.insert(staffSkills).values(faltando.map((serviceId) => ({ staffId, serviceId, enabled: true })))
  }
  console.log(`   serviços habilitados: ${faltando.length} novos (${servicoIds.length} no total)`)

  const jaTemEscala = await db
    .select({ id: staffSchedules.id })
    .from(staffSchedules)
    .where(and(eq(staffSchedules.staffId, staffId), eq(staffSchedules.unitId, unitId)))
    .limit(1)
  if (jaTemEscala.length === 0) {
    const hoje = new Date().toISOString().slice(0, 10)
    await db.insert(staffSchedules).values(
      DIAS_UTEIS.map((weekday) => ({
        staffId,
        unitId,
        weekday,
        startsAt: ABRE,
        endsAt: FECHA,
        validFrom: hoje,
      })),
    )
    console.log('   escala: seg-sáb 09:00-19:00 criada')
  } else {
    console.log('   escala: já existia')
  }
}

void main().catch((erro) => {
  console.error('\nFalhou:', erro instanceof Error ? erro.message : erro)
  process.exitCode = 1
})
