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
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toE164 } from '@/lib/format'

export interface StaffListRow {
  id: string
  name: string
  phone: string
  color: string
  acceptsOnlineBooking: boolean
  active: boolean
  unitNames: string[]
}

export async function listStaffAdmin(): Promise<StaffListRow[]> {
  const rows = await db
    .select({
      id: staffProfiles.id,
      name: staffProfiles.displayName,
      phone: users.phone,
      color: staffProfiles.color,
      acceptsOnlineBooking: staffProfiles.acceptsOnlineBooking,
      active: staffProfiles.active,
    })
    .from(staffProfiles)
    .innerJoin(users, eq(users.id, staffProfiles.userId))
    .orderBy(asc(staffProfiles.displayName))

  // nome da unidade é resolvido com um join à parte para não duplicar linhas de equipe
  const assignments = await db
    .select({ staffId: staffUnits.staffId, unitName: units.name })
    .from(staffUnits)
    .innerJoin(units, eq(units.id, staffUnits.unitId))

  const byStaff = new Map<string, string[]>()
  for (const row of assignments) {
    const list = byStaff.get(row.staffId) ?? []
    list.push(row.unitName)
    byStaff.set(row.staffId, list)
  }

  return rows.map((row) => ({ ...row, unitNames: byStaff.get(row.id) ?? [] }))
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

  const [units, skills, schedule] = await Promise.all([
    db.select({ unitId: staffUnits.unitId }).from(staffUnits).where(eq(staffUnits.staffId, id)),
    db.select({ serviceId: staffSkills.serviceId }).from(staffSkills).where(eq(staffSkills.staffId, id)),
    db
      .select()
      .from(staffSchedules)
      .where(and(eq(staffSchedules.staffId, id), isNull(staffSchedules.validTo)))
      .orderBy(asc(staffSchedules.weekday), asc(staffSchedules.startsAt)),
  ])

  return {
    staff: {
      ...row,
      unitIds: units.map((u) => u.unitId),
      serviceIds: skills.map((s) => s.serviceId),
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
}

export async function createStaff(input: StaffInput): Promise<string> {
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

    await tx.insert(userRoles).values({ userId, role: 'professional' }).onConflictDoNothing()
    await writeUnitsAndSkills(tx, staffId, input)
    return staffId
  })
}

export async function updateStaff(id: string, input: StaffInput): Promise<void> {
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

    await writeUnitsAndSkills(tx, id, input)
  })
}

async function writeUnitsAndSkills(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  staffId: string,
  input: StaffInput,
): Promise<void> {
  await tx.delete(staffUnits).where(eq(staffUnits.staffId, staffId))
  if (input.unitIds.length > 0) {
    await tx.insert(staffUnits).values(
      input.unitIds.map((unitId, index) => ({ staffId, unitId, isPrimary: index === 0 })),
    )
  }

  await tx.delete(staffSkills).where(eq(staffSkills.staffId, staffId))
  if (input.serviceIds.length > 0) {
    await tx.insert(staffSkills).values(input.serviceIds.map((serviceId) => ({ staffId, serviceId })))
  }
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
 */
export async function replaceSchedule(
  staffId: string,
  today: string,
  rows: readonly ScheduleInput[],
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(staffSchedules)
      .set({ validTo: today })
      .where(and(eq(staffSchedules.staffId, staffId), isNull(staffSchedules.validTo)))

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
