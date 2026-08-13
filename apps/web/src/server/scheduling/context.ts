import 'server-only'

/**
 * Montagem do contexto de disponibilidade.
 *
 * Tudo que o motor de `@studio/core` precisa para responder "que horários
 * existem" mora aqui: o que a unidade abre, quem trabalha, o que cada um sabe
 * fazer, o que já está ocupado e quais recursos existem. O motor é puro — esta
 * camada é a única que fala com o banco.
 *
 * A ocupação do profissional é buscada em TODAS as unidades, não só na
 * consultada: quem atende de manhã no Centro não pode aparecer livre no Jardins
 * no mesmo horário.
 */

import {
  addDaysInZone,
  intersectRanges,
  weekdayOfIsoDate,
  zonedDateTime,
  type PriceOverride,
  type ResourceAvailability,
  type ServiceSpec,
  type StaffAvailability,
  type TimeRange,
} from '@studio/core'
import {
  appointmentItems,
  appointmentResourceBlocks,
  appointmentStaffBlocks,
  appointments,
  resourceBlocks,
  resources,
  serviceCategories,
  serviceResourceRequirements,
  servicePricing,
  services,
  staffProfiles,
  staffSchedules,
  staffSkills,
  staffTimeOff,
  staffUnits,
  unitExceptions,
  unitHours,
  units,
  users,
} from '@studio/db'
import { and, asc, eq, gt, inArray, lt, lte, or, sql, type AnyColumn } from 'drizzle-orm'
import { db } from '@/lib/db'

// ─── tipos ──────────────────────────────────────────────────────────────────

/** Regras de agendamento da unidade, guardadas em `units.settings`. */
export interface UnitSettings {
  minLeadMin: number
  maxLeadDays: number
  granularityMin: number
  cancellationWindowHours: number
  interServiceGapMin: number
}

const SETTINGS_FALLBACK: UnitSettings = {
  minLeadMin: 120,
  maxLeadDays: 60,
  granularityMin: 15,
  cancellationWindowHours: 24,
  interServiceGapMin: 0,
}

export interface UnitInfo {
  id: string
  name: string
  slug: string
  district: string | null
  addressLine: string | null
  city: string | null
  postalCode: string | null
  phone: string | null
  email: string | null
  /** Foto da loja. Ausente é estado legítimo — a placa desenhada assume. */
  imageUrl: string | null
  timezone: string
  settings: UnitSettings
}

export interface ServiceInfo {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  basePrice: number
  spec: ServiceSpec
  /** Duração que o cliente enxerga: setup + processing + finish. */
  clientDurationMin: number
  onlineBookable: boolean
  requiresAssessment: boolean
  requiresAnamnesis: boolean
  deposit: { type: 'percent'; bps: number } | { type: 'fixed'; cents: number } | null
  /** Foto do serviço. Nem todo serviço fotografa bem; `null` é o caso normal. */
  imageUrl: string | null
  sortOrder: number
}

export interface StaffInfo {
  id: string
  name: string
  color: string
  acceptsOnlineBooking: boolean
}

export interface BookingContext {
  unit: UnitInfo
  /** Janelas de funcionamento no período, feriados já descontados. */
  openRanges: TimeRange[]
  /** Por data de parede `YYYY-MM-DD` — a agenda da recepção precisa dia a dia. */
  openRangesByDate: Map<string, TimeRange[]>
  services: Map<string, ServiceInfo>
  /** Nome da categoria por id, para agrupar o cardápio. */
  categories: Map<string, string>
  staff: StaffAvailability[]
  staffInfo: Map<string, StaffInfo>
  resources: ResourceAvailability[]
  resourceNames: Map<string, string>
  priceOverrides: PriceOverride[]
}

// ─── unidade ────────────────────────────────────────────────────────────────

function parseSettings(raw: Record<string, unknown>): UnitSettings {
  const num = (key: keyof UnitSettings): number =>
    typeof raw[key] === 'number' ? (raw[key] as number) : SETTINGS_FALLBACK[key]
  return {
    minLeadMin: num('minLeadMin'),
    maxLeadDays: num('maxLeadDays'),
    granularityMin: num('granularityMin'),
    cancellationWindowHours: num('cancellationWindowHours'),
    interServiceGapMin: num('interServiceGapMin'),
  }
}

function toUnitInfo(row: typeof units.$inferSelect): UnitInfo {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    district: row.district,
    addressLine: row.addressLine,
    city: row.city,
    postalCode: row.postalCode,
    phone: row.phone,
    email: row.email,
    imageUrl: row.imageUrl,
    timezone: row.timezone,
    settings: parseSettings(row.settings),
  }
}

export async function listUnits(): Promise<UnitInfo[]> {
  const rows = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  return rows.map(toUnitInfo)
}

export async function getUnitBySlug(slug: string): Promise<UnitInfo | null> {
  const [row] = await db.select().from(units).where(eq(units.slug, slug)).limit(1)
  return row ? toUnitInfo(row) : null
}

// ─── contexto ───────────────────────────────────────────────────────────────

export interface ContextOptions {
  unit: UnitInfo
  /** Primeira data de parede considerada, `YYYY-MM-DD`. */
  fromDate: string
  /** Última data de parede considerada, inclusive. */
  toDate: string
  /** Ignora a ocupação deste agendamento — usado ao remarcar. */
  excludeAppointmentId?: string
}

export async function loadBookingContext(options: ContextOptions): Promise<BookingContext> {
  const { unit, fromDate, toDate } = options
  const windowStart = zonedDateTime(fromDate, '00:00', unit.timezone)
  const windowEnd = zonedDateTime(addDaysInZone(toDate, 1), '00:00', unit.timezone)

  const [openRangesByDate, catalog, categories, team, resourceState, overrides] = await Promise.all([
    loadOpenRanges(unit, fromDate, toDate),
    loadServices(unit),
    loadCategories(unit),
    loadStaff(unit, fromDate, toDate, windowStart, windowEnd, options.excludeAppointmentId),
    loadResources(unit, windowStart, windowEnd, options.excludeAppointmentId),
    loadPriceOverrides(unit),
  ])

  const openRanges = [...openRangesByDate.values()].flat()

  // a escala bruta do profissional é recortada pelo horário da unidade: ninguém
  // atende com a loja fechada, mesmo que a escala diga que sim
  const staff: StaffAvailability[] = team.map((person) => ({
    staffId: person.id,
    skillServiceIds: person.skillServiceIds,
    workingRanges: intersectRanges(person.workingRanges, openRanges),
    busyRanges: person.busyRanges,
    acceptsOnlineBooking: person.acceptsOnlineBooking,
  }))

  return {
    unit,
    openRanges,
    openRangesByDate,
    services: catalog,
    categories,
    staff,
    staffInfo: new Map(
      team.map((person) => [
        person.id,
        {
          id: person.id,
          name: person.name,
          color: person.color,
          acceptsOnlineBooking: person.acceptsOnlineBooking,
        },
      ]),
    ),
    resources: resourceState.availability,
    resourceNames: resourceState.names,
    priceOverrides: overrides,
  }
}

// ─── funcionamento ──────────────────────────────────────────────────────────

async function loadOpenRanges(
  unit: UnitInfo,
  fromDate: string,
  toDate: string,
): Promise<Map<string, TimeRange[]>> {
  const [hours, exceptions] = await Promise.all([
    db.select().from(unitHours).where(eq(unitHours.unitId, unit.id)),
    db
      .select()
      .from(unitExceptions)
      .where(
        and(
          eq(unitExceptions.unitId, unit.id),
          sql`${unitExceptions.date} between ${fromDate} and ${toDate}`,
        ),
      ),
  ])

  const byWeekday = new Map<number, { opensAt: string; closesAt: string }[]>()
  for (const row of hours) {
    const list = byWeekday.get(row.weekday) ?? []
    list.push({ opensAt: row.opensAt, closesAt: row.closesAt })
    byWeekday.set(row.weekday, list)
  }

  const exceptionsByDate = new Map<string, typeof exceptions>()
  for (const row of exceptions) {
    const list = exceptionsByDate.get(row.date) ?? []
    list.push(row)
    exceptionsByDate.set(row.date, list)
  }

  const result = new Map<string, TimeRange[]>()
  for (let date = fromDate; date <= toDate; date = addDaysInZone(date, 1)) {
    const override = exceptionsByDate.get(date)
    let windows: { opensAt: string; closesAt: string }[]

    if (override && override.length > 0) {
      // feriado fechado vence qualquer outra linha do mesmo dia
      if (override.some((row) => row.closed)) continue
      windows = override
        .filter((row) => row.opensAt && row.closesAt)
        .map((row) => ({ opensAt: row.opensAt!, closesAt: row.closesAt! }))
    } else {
      windows = byWeekday.get(weekdayOfIsoDate(date)) ?? []
    }
    if (windows.length === 0) continue

    result.set(
      date,
      windows.map((w) => ({
        start: zonedDateTime(date, w.opensAt.slice(0, 5), unit.timezone),
        end: zonedDateTime(date, w.closesAt.slice(0, 5), unit.timezone),
      })),
    )
  }

  return result
}

// ─── catálogo ───────────────────────────────────────────────────────────────

async function loadServices(unit: UnitInfo): Promise<Map<string, ServiceInfo>> {
  const [rows, requirements] = await Promise.all([
    db
      .select()
      .from(services)
      .where(and(eq(services.organizationId, unitOrgId(unit)), eq(services.active, true)))
      .orderBy(asc(services.sortOrder), asc(services.name)),
    db
      .select({
        serviceId: serviceResourceRequirements.serviceId,
        resourceTypeId: serviceResourceRequirements.resourceTypeId,
      })
      .from(serviceResourceRequirements),
  ])

  const requiredByService = new Map<string, string[]>()
  for (const row of requirements) {
    const list = requiredByService.get(row.serviceId) ?? []
    list.push(row.resourceTypeId)
    requiredByService.set(row.serviceId, list)
  }

  const result = new Map<string, ServiceInfo>()
  for (const row of rows) {
    result.set(row.id, {
      id: row.id,
      name: row.name,
      description: row.description,
      categoryId: row.categoryId,
      basePrice: row.basePrice,
      spec: {
        serviceId: row.id,
        duration: {
          setupMin: row.setupMin,
          processingMin: row.processingMin,
          finishMin: row.finishMin,
          bufferBeforeMin: row.bufferBeforeMin,
          bufferAfterMin: row.bufferAfterMin,
        },
        requiredResourceTypeIds: requiredByService.get(row.id) ?? [],
      },
      clientDurationMin: row.setupMin + row.processingMin + row.finishMin,
      onlineBookable: row.onlineBookable,
      requiresAssessment: row.requiresAssessment,
      requiresAnamnesis: row.requiresAnamnesis,
      deposit: depositPolicy(row),
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
    })
  }
  return result
}

async function loadCategories(unit: UnitInfo): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: serviceCategories.id, name: serviceCategories.name })
    .from(serviceCategories)
    .where(
      and(
        eq(serviceCategories.organizationId, unitOrgId(unit)),
        eq(serviceCategories.active, true),
      ),
    )
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name))
  return new Map(rows.map((row) => [row.id, row.name]))
}

function depositPolicy(row: typeof services.$inferSelect): ServiceInfo['deposit'] {
  if (!row.requiresDeposit || row.depositValue === null) return null
  if (row.depositType === 'percent') return { type: 'percent', bps: row.depositValue }
  if (row.depositType === 'fixed') return { type: 'fixed', cents: row.depositValue }
  return null
}

/**
 * A unidade carrega a organização, mas `UnitInfo` não expõe o id da rede — o
 * catálogo é da rede e precisa dele. Resolvido por subconsulta para não obrigar
 * quem chama a carregar a organização inteira.
 */
function unitOrgId(unit: UnitInfo) {
  return sql<string>`(select organization_id from units where id = ${unit.id})`
}

// ─── equipe ─────────────────────────────────────────────────────────────────

interface StaffRow {
  id: string
  name: string
  color: string
  acceptsOnlineBooking: boolean
  skillServiceIds: string[]
  workingRanges: TimeRange[]
  busyRanges: TimeRange[]
}

async function loadStaff(
  unit: UnitInfo,
  fromDate: string,
  toDate: string,
  windowStart: Date,
  windowEnd: Date,
  excludeAppointmentId?: string,
): Promise<StaffRow[]> {
  const people = await db
    .select({
      id: staffProfiles.id,
      name: staffProfiles.displayName,
      color: staffProfiles.color,
      acceptsOnlineBooking: staffProfiles.acceptsOnlineBooking,
    })
    .from(staffProfiles)
    .innerJoin(staffUnits, eq(staffUnits.staffId, staffProfiles.id))
    .innerJoin(users, eq(users.id, staffProfiles.userId))
    .where(
      and(
        eq(staffUnits.unitId, unit.id),
        eq(staffProfiles.active, true),
        eq(users.status, 'active'),
      ),
    )
    .orderBy(asc(staffProfiles.displayName))

  if (people.length === 0) return []
  const staffIds = people.map((p) => p.id)

  const [skills, schedules, timeOff, busy] = await Promise.all([
    db
      .select({ staffId: staffSkills.staffId, serviceId: staffSkills.serviceId })
      .from(staffSkills)
      .where(and(inArray(staffSkills.staffId, staffIds), eq(staffSkills.enabled, true))),
    db
      .select()
      .from(staffSchedules)
      .where(
        and(
          inArray(staffSchedules.staffId, staffIds),
          eq(staffSchedules.unitId, unit.id),
          lte(staffSchedules.validFrom, toDate),
          // vigência aberta continua valendo
          or(sql`${staffSchedules.validTo} is null`, sql`${staffSchedules.validTo} >= ${fromDate}`),
        ),
      ),
    db
      .select()
      .from(staffTimeOff)
      .where(
        and(
          inArray(staffTimeOff.staffId, staffIds),
          lt(staffTimeOff.startsAt, windowEnd),
          gt(staffTimeOff.endsAt, windowStart),
        ),
      ),
    loadStaffBusy(staffIds, windowStart, windowEnd, excludeAppointmentId),
  ])

  const skillsByStaff = new Map<string, string[]>()
  for (const row of skills) {
    const list = skillsByStaff.get(row.staffId) ?? []
    list.push(row.serviceId)
    skillsByStaff.set(row.staffId, list)
  }

  const timeOffByStaff = new Map<string, TimeRange[]>()
  for (const row of timeOff) {
    // folga sem unidade vale em toda a rede
    if (row.unitId && row.unitId !== unit.id) continue
    const list = timeOffByStaff.get(row.staffId) ?? []
    list.push({ start: row.startsAt, end: row.endsAt })
    timeOffByStaff.set(row.staffId, list)
  }

  return people.map((person) => {
    const shifts = schedules.filter((row) => row.staffId === person.id)
    const workingRanges: TimeRange[] = []
    for (let date = fromDate; date <= toDate; date = addDaysInZone(date, 1)) {
      const weekday = weekdayOfIsoDate(date)
      for (const shift of shifts) {
        if (shift.weekday !== weekday) continue
        if (shift.validFrom > date) continue
        if (shift.validTo && shift.validTo < date) continue
        workingRanges.push({
          start: zonedDateTime(date, shift.startsAt.slice(0, 5), unit.timezone),
          end: zonedDateTime(date, shift.endsAt.slice(0, 5), unit.timezone),
        })
      }
    }

    return {
      ...person,
      skillServiceIds: skillsByStaff.get(person.id) ?? [],
      workingRanges,
      // férias e almoço entram como ocupação: o motor não os distingue de atendimento
      busyRanges: [...(busy.get(person.id) ?? []), ...(timeOffByStaff.get(person.id) ?? [])],
    }
  })
}

/**
 * Ocupação real do profissional, vinda das linhas de bloqueio. Serviço com
 * processamento gera dois blocos e o buraco entre eles fica livre — é o gap
 * booking funcionando na leitura, não só na escrita.
 */
async function loadStaffBusy(
  staffIds: readonly string[],
  windowStart: Date,
  windowEnd: Date,
  excludeAppointmentId?: string,
): Promise<Map<string, TimeRange[]>> {
  const rows = await db
    .select({
      staffId: appointmentStaffBlocks.staffId,
      start: sql<Date>`lower(${appointmentStaffBlocks.block})`,
      end: sql<Date>`upper(${appointmentStaffBlocks.block})`,
    })
    .from(appointmentStaffBlocks)
    .innerJoin(appointmentItems, eq(appointmentItems.id, appointmentStaffBlocks.appointmentItemId))
    .where(
      and(
        inArray(appointmentStaffBlocks.staffId, [...staffIds]),
        overlapsWindow(appointmentStaffBlocks.block, windowStart, windowEnd),
        excludeAppointmentId
          ? sql`${appointmentItems.appointmentId} <> ${excludeAppointmentId}`
          : undefined,
      ),
    )

  return groupRanges(rows, 'staffId')
}

// ─── recursos ───────────────────────────────────────────────────────────────

async function loadResources(
  unit: UnitInfo,
  windowStart: Date,
  windowEnd: Date,
  excludeAppointmentId?: string,
): Promise<{ availability: ResourceAvailability[]; names: Map<string, string> }> {
  const rows = await db
    .select()
    .from(resources)
    .where(and(eq(resources.unitId, unit.id), eq(resources.active, true)))
    .orderBy(asc(resources.priority), asc(resources.name))

  if (rows.length === 0) return { availability: [], names: new Map() }
  const resourceIds = rows.map((r) => r.id)

  const [booked, maintenance] = await Promise.all([
    db
      .select({
        resourceId: appointmentResourceBlocks.resourceId,
        start: sql<Date>`lower(${appointmentResourceBlocks.block})`,
        end: sql<Date>`upper(${appointmentResourceBlocks.block})`,
      })
      .from(appointmentResourceBlocks)
      .innerJoin(
        appointmentItems,
        eq(appointmentItems.id, appointmentResourceBlocks.appointmentItemId),
      )
      .where(
        and(
          inArray(appointmentResourceBlocks.resourceId, resourceIds),
          overlapsWindow(appointmentResourceBlocks.block, windowStart, windowEnd),
          excludeAppointmentId
            ? sql`${appointmentItems.appointmentId} <> ${excludeAppointmentId}`
            : undefined,
        ),
      ),
    db
      .select()
      .from(resourceBlocks)
      .where(
        and(
          inArray(resourceBlocks.resourceId, resourceIds),
          lt(resourceBlocks.startsAt, windowEnd),
          gt(resourceBlocks.endsAt, windowStart),
        ),
      ),
  ])

  const busy = groupRanges(booked, 'resourceId')
  for (const row of maintenance) {
    const list = busy.get(row.resourceId) ?? []
    list.push({ start: row.startsAt, end: row.endsAt })
    busy.set(row.resourceId, list)
  }

  return {
    availability: rows.map((row) => ({
      resourceId: row.id,
      resourceTypeId: row.resourceTypeId,
      busyRanges: busy.get(row.id) ?? [],
    })),
    names: new Map(rows.map((row) => [row.id, row.name])),
  }
}

// ─── preços ─────────────────────────────────────────────────────────────────

async function loadPriceOverrides(unit: UnitInfo): Promise<PriceOverride[]> {
  const rows = await db
    .select()
    .from(servicePricing)
    .where(or(sql`${servicePricing.unitId} is null`, eq(servicePricing.unitId, unit.id)))

  return rows.map((row) => ({
    serviceId: row.serviceId,
    unitId: row.unitId,
    staffId: row.staffId,
    price: row.price,
    durationOverrideMin: row.durationOverrideMin,
  }))
}

// ─── util ───────────────────────────────────────────────────────────────────

/**
 * `bloco && [início, fim)`.
 *
 * Em SQL cru o driver não recebe o tipo da coluna pelo Drizzle e rejeita `Date`
 * — por isso o ISO explícito com cast. Já custou uma depuração; não simplifique.
 */
function overlapsWindow(column: AnyColumn, start: Date, end: Date) {
  return sql`${column} && tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz)`
}

/** `lower()`/`upper()` de tstzrange podem voltar como texto no driver. */
function groupRanges(
  rows: readonly { start: Date | string; end: Date | string }[],
  key: 'staffId' | 'resourceId',
): Map<string, TimeRange[]> {
  const result = new Map<string, TimeRange[]>()
  for (const row of rows as readonly Record<string, unknown>[]) {
    const id = row[key] as string
    const list = result.get(id) ?? []
    list.push({ start: toDate(row.start), end: toDate(row.end) })
    result.set(id, list)
  }
  return result
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value))
}

/** Reexporta a tabela de agendamentos para quem só precisa do tipo. */
export type AppointmentRow = typeof appointments.$inferSelect

/**
 * O que a unidade REALMENTE entrega: catálogo é da rede, mas só vale o serviço
 * para o qual existe recurso instalado e alguém habilitado na equipe local.
 * Sem esse filtro a cliente escolhe "cabelo com cabine" numa loja sem cabine.
 */
export function deliverableServices(
  ctx: BookingContext,
  options: { onlineOnly?: boolean } = {},
): ServiceInfo[] {
  const resourceTypesPresent = new Set(ctx.resources.map((r) => r.resourceTypeId))
  const skills = new Set(ctx.staff.flatMap((person) => person.skillServiceIds))
  const onlineSkills = new Set(
    ctx.staff
      .filter((person) => person.acceptsOnlineBooking !== false)
      .flatMap((person) => person.skillServiceIds),
  )
  const usable = options.onlineOnly ? onlineSkills : skills

  return [...ctx.services.values()]
    .filter((service) => {
      if (options.onlineOnly && (!service.onlineBookable || service.requiresAssessment)) return false
      if (!usable.has(service.id)) return false
      return service.spec.requiredResourceTypeIds.every((type) => resourceTypesPresent.has(type))
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
}

/** Profissionais que podem executar TODO o carrinho. */
export function staffForCart(
  ctx: BookingContext,
  serviceIds: readonly string[],
  options: { onlineOnly?: boolean } = {},
): StaffInfo[] {
  return ctx.staff
    .filter((person) => {
      if (options.onlineOnly && person.acceptsOnlineBooking === false) return false
      if (person.workingRanges.length === 0) return false
      return serviceIds.every((id) => person.skillServiceIds.includes(id))
    })
    .map((person) => ctx.staffInfo.get(person.staffId))
    .filter((info): info is StaffInfo => info !== undefined)
}
