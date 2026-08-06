import 'server-only'

/**
 * Leituras da agenda já formada — o oposto de `availability.ts`, que calcula o
 * que ainda não existe. Tudo aqui é "mostre o que está marcado".
 */

import { zonedDateTime } from '@studio/core'
import {
  appointmentItems,
  appointmentStaffBlocks,
  appointments,
  clientProfiles,
  services,
  staffProfiles,
  units,
  users,
} from '@studio/db'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { UnitInfo } from './context'

export type AppointmentStatus = (typeof appointments.$inferSelect)['status']

export interface AppointmentItemView {
  id: string
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  staffColor: string
  start: Date
  end: Date
  price: number
  durationMin: number
  /** Perfil congelado: é o que revela o intervalo de processamento na tela. */
  durationProfile: { setupMin: number; processingMin: number; finishMin: number }
}

export interface AppointmentView {
  id: string
  unitId: string
  unitName: string
  unitSlug: string
  timezone: string
  clientId: string
  clientName: string
  clientPhone: string
  status: AppointmentStatus
  source: (typeof appointments.$inferSelect)['source']
  start: Date
  end: Date
  totalPrice: number
  depositRequired: number
  depositPaidAt: Date | null
  clientNote: string | null
  internalNote: string | null
  cancellationReason: string | null
  items: AppointmentItemView[]
}

const BASE_COLUMNS = {
  id: appointments.id,
  unitId: appointments.unitId,
  unitName: units.name,
  unitSlug: units.slug,
  timezone: units.timezone,
  clientId: appointments.clientId,
  clientName: users.name,
  clientPhone: users.phone,
  status: appointments.status,
  source: appointments.source,
  start: appointments.startsAt,
  end: appointments.endsAt,
  totalPrice: appointments.totalPrice,
  depositRequired: appointments.depositRequired,
  depositPaidAt: appointments.depositPaidAt,
  clientNote: appointments.clientNote,
  internalNote: appointments.internalNote,
  cancellationReason: appointments.cancellationReason,
}

function baseQuery() {
  return db
    .select(BASE_COLUMNS)
    .from(appointments)
    .innerJoin(units, eq(units.id, appointments.unitId))
    .innerJoin(clientProfiles, eq(clientProfiles.id, appointments.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
}

async function attachItems(
  rows: Awaited<ReturnType<ReturnType<typeof baseQuery>['where']>>,
): Promise<AppointmentView[]> {
  if (rows.length === 0) return []

  const items = await db
    .select({
      id: appointmentItems.id,
      appointmentId: appointmentItems.appointmentId,
      serviceId: appointmentItems.serviceId,
      serviceName: services.name,
      staffId: appointmentItems.staffId,
      staffName: staffProfiles.displayName,
      staffColor: staffProfiles.color,
      start: appointmentItems.startsAt,
      end: appointmentItems.endsAt,
      price: appointmentItems.price,
      durationMin: appointmentItems.durationMin,
      durationProfile: appointmentItems.durationProfile,
    })
    .from(appointmentItems)
    .innerJoin(services, eq(services.id, appointmentItems.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, appointmentItems.staffId))
    .where(
      inArray(
        appointmentItems.appointmentId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(appointmentItems.sortOrder), asc(appointmentItems.startsAt))

  const byAppointment = new Map<string, AppointmentItemView[]>()
  for (const item of items) {
    const list = byAppointment.get(item.appointmentId) ?? []
    const { appointmentId, ...view } = item
    list.push(view)
    byAppointment.set(appointmentId, list)
  }

  return rows.map((row) => ({ ...row, items: byAppointment.get(row.id) ?? [] }))
}

export async function getAppointment(id: string): Promise<AppointmentView | null> {
  const rows = await baseQuery().where(eq(appointments.id, id)).limit(1)
  const [view] = await attachItems(rows)
  return view ?? null
}

/** Agenda de um dia numa unidade, em ordem de início. */
export async function listDayAppointments(
  unit: UnitInfo,
  date: string,
): Promise<AppointmentView[]> {
  const dayStart = zonedDateTime(date, '00:00', unit.timezone)
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000)

  const rows = await baseQuery()
    .where(
      and(
        eq(appointments.unitId, unit.id),
        gte(appointments.startsAt, dayStart),
        lt(appointments.startsAt, dayEnd),
      ),
    )
    .orderBy(asc(appointments.startsAt))

  return attachItems(rows)
}

/** Histórico da cliente, do mais recente para o mais antigo. */
export async function listClientAppointments(
  clientId: string,
  limit = 30,
): Promise<AppointmentView[]> {
  const rows = await baseQuery()
    .where(eq(appointments.clientId, clientId))
    .orderBy(sql`${appointments.startsAt} desc`)
    .limit(limit)

  return attachItems(rows)
}

export interface DayCounters {
  total: number
  reserved: number
  completed: number
  cancelled: number
  revenue: number
  expected: number
}

/** Cabeçalho da agenda da recepção. */
export function countDay(list: readonly AppointmentView[]): DayCounters {
  const cancelled = new Set(['cancelled_by_client', 'cancelled_by_studio', 'no_show'])
  let counters: DayCounters = {
    total: list.length,
    reserved: 0,
    completed: 0,
    cancelled: 0,
    revenue: 0,
    expected: 0,
  }

  for (const item of list) {
    if (cancelled.has(item.status)) {
      counters.cancelled += 1
      continue
    }
    counters.reserved += 1
    counters.expected += item.totalPrice
    if (item.status === 'completed') {
      counters.completed += 1
      counters.revenue += item.totalPrice
    }
  }

  return counters
}

/**
 * Blocos do profissional no dia — é o que desenha a coluna da agenda com o
 * buraco de processamento visível.
 */
export async function listStaffBlocks(
  unit: UnitInfo,
  date: string,
): Promise<{ staffId: string; start: Date; end: Date; appointmentId: string }[]> {
  const dayStart = zonedDateTime(date, '00:00', unit.timezone)
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000)

  const rows = await db
    .select({
      staffId: appointmentStaffBlocks.staffId,
      appointmentId: appointmentItems.appointmentId,
      start: sql<string>`lower(${appointmentStaffBlocks.block})`,
      end: sql<string>`upper(${appointmentStaffBlocks.block})`,
    })
    .from(appointmentStaffBlocks)
    .innerJoin(appointmentItems, eq(appointmentItems.id, appointmentStaffBlocks.appointmentItemId))
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .where(
      and(
        eq(appointments.unitId, unit.id),
        // ISO explícito: em SQL cru o driver não aceita `Date`
        sql`${appointmentStaffBlocks.block} && tstzrange(${dayStart.toISOString()}::timestamptz, ${dayEnd.toISOString()}::timestamptz)`,
      ),
    )

  return rows.map((row) => ({
    staffId: row.staffId,
    appointmentId: row.appointmentId,
    start: new Date(row.start),
    end: new Date(row.end),
  }))
}
