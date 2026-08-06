import 'server-only'

/**
 * Cadastro de unidades: dados, horário de funcionamento e exceções.
 *
 * `unit_hours` pode ter mais de uma linha por dia (intervalo de almoço), e é
 * isso que o formulário edita — a UI trabalha em cima da lista inteira do dia,
 * não linha a linha, porque é assim que a dona pensa ("abre 9, fecha pro
 * almoço ao meio-dia, volta 1h").
 */

import { organizations, unitExceptions, unitHours, units } from '@studio/db'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'

export interface UnitSettingsForm {
  minLeadMin: number
  maxLeadDays: number
  granularityMin: number
  cancellationWindowHours: number
  interServiceGapMin: number
  // índice para caber em `jsonb().$type<Record<string, unknown>>()`
  [key: string]: number
}

export interface UnitRow {
  id: string
  name: string
  slug: string
  phone: string | null
  email: string | null
  addressLine: string | null
  district: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  timezone: string
  active: boolean
  imageUrl: string | null
  settings: UnitSettingsForm
}

export interface HoursRow {
  id: string
  weekday: number
  opensAt: string
  closesAt: string
}

export interface ExceptionRow {
  id: string
  date: string
  closed: boolean
  opensAt: string | null
  closesAt: string | null
  reason: string | null
}

const DEFAULT_SETTINGS: UnitSettingsForm = {
  minLeadMin: 120,
  maxLeadDays: 60,
  granularityMin: 15,
  cancellationWindowHours: 24,
  interServiceGapMin: 0,
}

function toSettings(raw: unknown): UnitSettingsForm {
  const s = (raw ?? {}) as Partial<UnitSettingsForm>
  return {
    minLeadMin: s.minLeadMin ?? DEFAULT_SETTINGS.minLeadMin,
    maxLeadDays: s.maxLeadDays ?? DEFAULT_SETTINGS.maxLeadDays,
    granularityMin: s.granularityMin ?? DEFAULT_SETTINGS.granularityMin,
    cancellationWindowHours: s.cancellationWindowHours ?? DEFAULT_SETTINGS.cancellationWindowHours,
    interServiceGapMin: s.interServiceGapMin ?? DEFAULT_SETTINGS.interServiceGapMin,
  }
}

export async function listUnitsAdmin(): Promise<UnitRow[]> {
  const rows = await db.select().from(units).orderBy(asc(units.name))
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    phone: row.phone,
    email: row.email,
    addressLine: row.addressLine,
    district: row.district,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    timezone: row.timezone,
    active: row.active,
    imageUrl: row.imageUrl,
    settings: toSettings(row.settings),
  }))
}

export async function getUnitAdmin(
  id: string,
): Promise<{ unit: UnitRow; hours: HoursRow[]; exceptions: ExceptionRow[] } | null> {
  const [row] = await db.select().from(units).where(eq(units.id, id)).limit(1)
  if (!row) return null

  const [hours, exceptions] = await Promise.all([
    db
      .select()
      .from(unitHours)
      .where(eq(unitHours.unitId, id))
      .orderBy(asc(unitHours.weekday), asc(unitHours.opensAt)),
    db
      .select()
      .from(unitExceptions)
      .where(eq(unitExceptions.unitId, id))
      .orderBy(asc(unitExceptions.date)),
  ])

  return {
    unit: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      phone: row.phone,
      email: row.email,
      addressLine: row.addressLine,
      district: row.district,
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      timezone: row.timezone,
      active: row.active,
      imageUrl: row.imageUrl,
      settings: toSettings(row.settings),
    },
    hours: hours.map((h) => ({
      id: h.id,
      weekday: h.weekday,
      opensAt: h.opensAt.slice(0, 5),
      closesAt: h.closesAt.slice(0, 5),
    })),
    exceptions: exceptions.map((e) => ({
      id: e.id,
      date: e.date,
      closed: e.closed,
      opensAt: e.opensAt ? e.opensAt.slice(0, 5) : null,
      closesAt: e.closesAt ? e.closesAt.slice(0, 5) : null,
      reason: e.reason,
    })),
  }
}

export interface UnitInput {
  name: string
  slug: string
  phone?: string
  email?: string
  addressLine?: string
  district?: string
  city?: string
  state?: string
  postalCode?: string
  timezone: string
  active: boolean
  settings: UnitSettingsForm
}

/** Uma linha por dia de expediente — a tela manda a lista inteira, e a grava por cima. */
export interface HoursInput {
  weekday: number
  opensAt: string
  closesAt: string
}

export async function createUnit(input: UnitInput): Promise<string> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1)
  if (!org) throw new Error('nenhuma organização cadastrada')

  const [row] = await db
    .insert(units)
    .values({ organizationId: org.id, ...unitValues(input) })
    .returning({ id: units.id })
  return row!.id
}

export async function updateUnit(id: string, input: UnitInput): Promise<void> {
  await db.update(units).set(unitValues(input)).where(eq(units.id, id))
}

/**
 * Grava a foto separada do resto do cadastro.
 *
 * Fica fora de `UnitInput` porque a chave do arquivo precisa do id da unidade,
 * e numa unidade nova o id só existe depois do insert. Também deixa "não mexi
 * na foto" ser o caminho barato: quem não enviou arquivo não passa por aqui.
 */
export async function setUnitImage(id: string, imageUrl: string | null): Promise<void> {
  await db.update(units).set({ imageUrl }).where(eq(units.id, id))
}

/** A URL atual, para descartar o arquivo antigo quando ele for substituído. */
export async function getUnitImage(id: string): Promise<string | null> {
  const [row] = await db.select({ imageUrl: units.imageUrl }).from(units).where(eq(units.id, id)).limit(1)
  return row?.imageUrl ?? null
}

function unitValues(input: UnitInput) {
  return {
    name: input.name,
    slug: input.slug,
    phone: input.phone || null,
    email: input.email || null,
    addressLine: input.addressLine || null,
    district: input.district || null,
    city: input.city || null,
    state: input.state || null,
    postalCode: input.postalCode || null,
    timezone: input.timezone,
    active: input.active,
    settings: input.settings,
  }
}

/** Substitui o expediente do dia inteiro. Apagar tudo e reinserir é mais simples que diffar. */
export async function replaceUnitHours(unitId: string, rows: readonly HoursInput[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(unitHours).where(eq(unitHours.unitId, unitId))
    if (rows.length === 0) return
    await tx.insert(unitHours).values(
      rows.map((row) => ({
        unitId,
        weekday: row.weekday,
        opensAt: row.opensAt,
        closesAt: row.closesAt,
      })),
    )
  })
}

export interface ExceptionInput {
  date: string
  closed: boolean
  opensAt?: string
  closesAt?: string
  reason?: string
}

export async function addUnitException(unitId: string, input: ExceptionInput): Promise<void> {
  await db.insert(unitExceptions).values({
    unitId,
    date: input.date,
    closed: input.closed,
    opensAt: input.closed ? null : input.opensAt || null,
    closesAt: input.closed ? null : input.closesAt || null,
    reason: input.reason || null,
  })
}

export async function removeUnitException(id: string): Promise<void> {
  await db.delete(unitExceptions).where(eq(unitExceptions.id, id))
}
