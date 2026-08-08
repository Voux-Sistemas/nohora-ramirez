import 'server-only'

/**
 * Cadastro de equipe: pessoa, unidades onde atende e escala semanal.
 *
 * `staff_schedules` nunca é editada linha a linha — trocar a escala fecha a
 * vigência antiga (`validTo`) e abre uma nova, para o passado da agenda não
 * mudar retroativamente. Aqui, para o primeiro corte do produto, cada troca
 * decide fechar a vigência anterior a partir de HOJE e abrir a nova a partir
 * de amanhã; qualquer visita já marcada continua igual.
 */

import { staffProfiles, staffSchedules, staffSkills, staffUnits, units, userRoles, users } from '@studio/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toE164 } from '@/lib/format'

/**
 * Papel de acesso da pessoa, do jeito que a dona fala.
 *
 * `profissional` atende e vê a própria agenda; `gerente` toca a operação das
 * unidades marcadas no cadastro. Vira linha em `user_roles` — e é de lá que os
 * porteiros leem. Quem nomeia gerente é só a dona.
 */
export type PapelEquipe = 'profissional' | 'gerente'

export interface StaffListRow {
  id: string
  name: string
  phone: string
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitNames: string[]
  papel: PapelEquipe
}

/**
 * A equipe que quem pediu pode ver. `unidadeIds` nulo é a rede inteira; uma
 * lista recorta para quem atende nessas lojas — o gerente do Centro não abre a
 * ficha, o telefone nem a escala de quem só trabalha no Jardins.
 */
export async function listStaffAdmin(
  unidadeIds: readonly string[] | null = null,
): Promise<StaffListRow[]> {
  if (unidadeIds !== null && unidadeIds.length === 0) return []

  const rows = await db
    .select({
      id: staffProfiles.id,
      name: staffProfiles.displayName,
      phone: users.phone,
      color: staffProfiles.color,
      acceptsOnlineBooking: staffProfiles.acceptsOnlineBooking,
      active: staffProfiles.active,
      userId: staffProfiles.userId,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(users.id, staffProfiles.userId))
    .orderBy(asc(staffProfiles.displayName))

  // nome da unidade é resolvido com um join à parte para não duplicar linhas de equipe
  const assignments = await db
    .select({ staffId: staffUnits.staffId, unitId: staffUnits.unitId, unitName: units.name })
    .from(staffUnits)
    .innerJoin(units, eq(units.id, staffUnits.unitId))

  const byStaff = new Map<string, { id: string; name: string }[]>()
  for (const row of assignments) {
    const list = byStaff.get(row.staffId) ?? []
    list.push({ id: row.unitId, name: row.unitName })
    byStaff.set(row.staffId, list)
  }

  const gerentes = await gerentesPorUsuario(rows.map((row) => row.userId))

  return rows
    .map((row) => {
      const lotacoes = byStaff.get(row.id) ?? []
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        color: row.color,
        acceptsOnlineBooking: row.acceptsOnlineBooking,
        active: row.active,
        /* A lista de lojas também é recortada: dizer "atende no Centro e no
           Jardins" para quem só responde pelo Centro já conta de mais. */
        unitNames: lotacoes
          .filter((item) => unidadeIds === null || unidadeIds.includes(item.id))
          .map((item) => item.name),
        papel: gerentes.has(row.userId) ? ('gerente' as const) : ('profissional' as const),
        unitIds: lotacoes.map((item) => item.id),
      }
    })
    .filter((row) =>
      unidadeIds === null ? true : row.unitIds.some((unitId) => unidadeIds.includes(unitId)),
    )
    .map(({ unitIds: _unitIds, ...row }) => row)
}

/** Quais destes usuários têm alguma linha de `unit_manager`. */
async function gerentesPorUsuario(userIds: readonly string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(and(inArray(userRoles.userId, [...userIds]), eq(userRoles.role, 'unit_manager')))
  return new Set(rows.map((row) => row.userId))
}

/**
 * Quem é a pessoa por trás do perfil e em que lojas ela atende.
 *
 * As ações de equipe recebem só o `staffId` do formulário. É por aqui que ele
 * vira "conta de quem" e "loja de quem", para o porteiro perguntar ao banco em
 * vez de acreditar num campo escondido — trocar o `userId` do formulário era um
 * jeito de trocar a senha de qualquer conta, inclusive a da dona.
 */
export async function alcanceDoStaff(
  id: string,
): Promise<{ userId: string; unitIds: string[] } | null> {
  const [row] = await db
    .select({ userId: staffProfiles.userId })
    .from(staffProfiles)
    .where(eq(staffProfiles.id, id))
    .limit(1)
  if (!row) return null

  const lotacoes = await db
    .select({ unitId: staffUnits.unitId })
    .from(staffUnits)
    .where(eq(staffUnits.staffId, id))

  return { userId: row.userId, unitIds: lotacoes.map((item) => item.unitId) }
}

export interface StaffDetail {
  id: string
  userId: string
  name: string
  phone: string
  email: string | null
  bio: string | null
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitIds: string[]
  serviceIds: string[]
  papel: PapelEquipe
}

export interface ScheduleRow {
  id: string
  unitId: string
  weekday: number
  startsAt: string
  endsAt: string
}

export async function getStaffAdmin(
  id: string,
): Promise<{ staff: StaffDetail; schedule: ScheduleRow[] } | null> {
  const [row] = await db
    .select({
      id: staffProfiles.id,
      userId: staffProfiles.userId,
      name: staffProfiles.displayName,
      phone: users.phone,
      email: users.email,
      bio: staffProfiles.bio,
      color: staffProfiles.color,
      acceptsOnlineBooking: staffProfiles.acceptsOnlineBooking,
      active: staffProfiles.active,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(users.id, staffProfiles.userId))
    .where(eq(staffProfiles.id, id))
    .limit(1)
  if (!row) return null

  const [units, skills, schedule, gerentes] = await Promise.all([
    db.select({ unitId: staffUnits.unitId }).from(staffUnits).where(eq(staffUnits.staffId, id)),
    db.select({ serviceId: staffSkills.serviceId }).from(staffSkills).where(eq(staffSkills.staffId, id)),
    db
      .select()
      .from(staffSchedules)
      .where(and(eq(staffSchedules.staffId, id), isNull(staffSchedules.validTo)))
      .orderBy(asc(staffSchedules.weekday), asc(staffSchedules.startsAt)),
    gerentesPorUsuario([row.userId]),
  ])

  return {
    staff: {
      ...row,
      unitIds: units.map((u) => u.unitId),
      serviceIds: skills.map((s) => s.serviceId),
      papel: gerentes.has(row.userId) ? 'gerente' : 'profissional',
    },
    schedule: schedule.map((s) => ({
      id: s.id,
      unitId: s.unitId,
      weekday: s.weekday,
      startsAt: s.startsAt.slice(0, 5),
      endsAt: s.endsAt.slice(0, 5),
    })),
  }
}

export interface StaffInput {
  name: string
  phone: string
  email?: string
  bio?: string
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitIds: string[]
  serviceIds: string[]
  /**
   * Só a dona manda este campo. Ausente quer dizer "não mexa no papel" — é o
   * que o gerente salva ao editar a ficha de quem atende na loja dele.
   */
  papel?: PapelEquipe
}

/**
 * O recorte de quem está salvando. `null` é a rede.
 *
 * Existe por causa de uma armadilha concreta: o formulário do gerente só mostra
 * as lojas dele, e gravar substituindo a lotação inteira tiraria a profissional
 * das outras unidades sem ninguém perceber. Com escopo, a gravação troca apenas
 * as lotações de dentro do alcance e deixa as de fora como estavam.
 */
export type EscopoEquipe = readonly string[] | null

export async function createStaff(input: StaffInput, escopo: EscopoEquipe = null): Promise<string> {
  const phone = toE164(input.phone)
  if (!phone) throw new Error('telefone inválido')

  return db.transaction(async (tx) => {
    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1)

    const userId =
      existingUser?.id ??
      (
        await tx
          .insert(users)
          .values({ phone, name: input.name, email: input.email || null })
          .returning({ id: users.id })
      )[0]!.id

    const [profile] = await tx
      .insert(staffProfiles)
      .values({
        userId,
        displayName: input.name,
        bio: input.bio || null,
        color: input.color,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        active: input.active,
      })
      .returning({ id: staffProfiles.id })
    const staffId = profile!.id

    /* Todo mundo da equipe entra como profissional: é o papel que dá a agenda
       própria. Gerente é um degrau A MAIS, não um degrau no lugar deste. */
    await tx.insert(userRoles).values({ userId, role: 'professional' }).onConflictDoNothing()
    await writeUnitsAndSkills(tx, staffId, input, escopo)
    await syncPapel(tx, userId, input.papel, input.unitIds)
    return staffId
  })
}

export async function updateStaff(
  id: string,
  input: StaffInput,
  escopo: EscopoEquipe = null,
): Promise<void> {
  const phone = toE164(input.phone)
  if (!phone) throw new Error('telefone inválido')

  await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ userId: staffProfiles.userId })
      .from(staffProfiles)
      .where(eq(staffProfiles.id, id))
      .limit(1)
    if (!profile) throw new Error('profissional não encontrado')

    await tx
      .update(users)
      .set({ name: input.name, phone, email: input.email || null })
      .where(eq(users.id, profile.userId))

    await tx
      .update(staffProfiles)
      .set({
        displayName: input.name,
        bio: input.bio || null,
        color: input.color,
        acceptsOnlineBooking: input.acceptsOnlineBooking,
        active: input.active,
      })
      .where(eq(staffProfiles.id, id))

    await writeUnitsAndSkills(tx, id, input, escopo)
    await syncPapel(tx, profile.userId, input.papel, input.unitIds)
  })
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function writeUnitsAndSkills(
  tx: Tx,
  staffId: string,
  input: StaffInput,
  escopo: EscopoEquipe,
): Promise<void> {
  const dentro = (unitId: string) => escopo === null || escopo.includes(unitId)

  const atuais = await tx
    .select({ unitId: staffUnits.unitId })
    .from(staffUnits)
    .where(eq(staffUnits.staffId, staffId))

  /* De fora do escopo, fica o que já estava; de dentro, vale o formulário. */
  const preservadas = atuais.map((row) => row.unitId).filter((unitId) => !dentro(unitId))
  const novas = input.unitIds.filter(dentro)
  const finais = [...new Set([...preservadas, ...novas])]

  await tx.delete(staffUnits).where(eq(staffUnits.staffId, staffId))
  if (finais.length > 0) {
    await tx.insert(staffUnits).values(
      finais.map((unitId, index) => ({ staffId, unitId, isPrimary: index === 0 })),
    )
  }

  /* Habilidade é do par de mãos, não da loja: não tem dimensão de unidade para
     recortar, e quem cuida da equipe decide o que ela faz. */
  await tx.delete(staffSkills).where(eq(staffSkills.staffId, staffId))
  if (input.serviceIds.length > 0) {
    await tx.insert(staffSkills).values(input.serviceIds.map((serviceId) => ({ staffId, serviceId })))
  }
}

/**
 * Escreve o degrau de acesso em `user_roles`.
 *
 * Uma linha de `unit_manager` por unidade — é assim que `permissoes.ts` lê o
 * alcance do gerente. `owner` nunca é tocado aqui: a dona não se rebaixa por um
 * formulário de equipe, e ninguém vira dona por ele.
 */
async function syncPapel(
  tx: Tx,
  userId: string,
  papel: PapelEquipe | undefined,
  unitIds: readonly string[],
): Promise<void> {
  if (!papel) return

  await tx
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, 'unit_manager')))

  if (papel !== 'gerente' || unitIds.length === 0) return
  await tx
    .insert(userRoles)
    .values(unitIds.map((unitId) => ({ userId, role: 'unit_manager' as const, unitId })))
    .onConflictDoNothing()
}

export interface ScheduleInput {
  unitId: string
  weekday: number
  startsAt: string
  endsAt: string
}

/**
 * Substitui a escala vigente por uma nova, a partir de hoje. Escalas antigas
 * (`validTo` preenchido) ficam intactas — é o histórico que explica quem
 * trabalhava quando.
 *
 * O `escopo` protege o mesmo ponto que a lotação: o gerente do Centro salvando a
 * escala de quem também atende no Jardins não pode fechar a terça-feira de lá,
 * que ele nem enxerga no formulário.
 */
export async function replaceSchedule(
  staffId: string,
  today: string,
  rows: readonly ScheduleInput[],
  escopo: EscopoEquipe = null,
): Promise<void> {
  if (escopo !== null && escopo.length === 0) return

  await db.transaction(async (tx) => {
    await tx
      .update(staffSchedules)
      .set({ validTo: today })
      .where(
        and(
          eq(staffSchedules.staffId, staffId),
          isNull(staffSchedules.validTo),
          escopo === null ? undefined : inArray(staffSchedules.unitId, [...escopo]),
        ),
      )

    if (rows.length === 0) return
    await tx.insert(staffSchedules).values(
      rows.map((row) => ({
        staffId,
        unitId: row.unitId,
        weekday: row.weekday,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        validFrom: today,
      })),
    )
  })
}
