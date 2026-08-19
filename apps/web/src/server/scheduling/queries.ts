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
  notificationLogs,
  services,
  staffProfiles,
  units,
  users,
} from '@studio/db'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { Idioma } from '@/i18n/tipos'
import { db } from '@/lib/db'
import { idiomaDaFicha } from '@/lib/idioma'
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
  /** A língua em que ela marcou — é nela que a confirmação de WhatsApp sai. */
  clientIdioma: Idioma
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
  /**
   * Quando a confirmação de WhatsApp foi dada como enviada, ou `null`.
   *
   * Não é o mesmo que o estado `confirmed`, e a distinção é o ponto: aquele diz
   * que a CLIENTE confirmou que vem; este diz que alguém da casa lhe escreveu.
   * São dois factos, e confundi-los era prometer à dona uma coisa e mostrar-lhe
   * outra.
   */
  confirmacaoEnviadaEm: Date | null
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
  clientPreferences: clientProfiles.preferences,
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

  const confirmadas = await confirmacoesEnviadas(rows.map((row) => row.id))

  /* `clientPreferences` fica de fora do que sai daqui: é jsonb de outros donos e
     esta vista atravessa para o browser. O que dela interessa já foi lido. */
  return rows.map(({ clientPreferences, ...row }) => ({
    ...row,
    clientIdioma: idiomaDaFicha(clientPreferences),
    confirmacaoEnviadaEm: confirmadas.get(row.id) ?? null,
    items: byAppointment.get(row.id) ?? [],
  }))
}

/**
 * Quando cada atendimento recebeu a confirmação escrita.
 *
 * Consulta à parte, e não um `leftJoin` no `baseQuery`: um atendimento pode ter
 * mais do que um registo (enviar, desfazer, enviar de novo) e o join
 * multiplicaria a linha do atendimento por cada um deles — a agenda passava a
 * mostrar a mesma cliente duas vezes por causa de um envio repetido.
 *
 * `max` porque o que interessa é a última: quem desfez e voltou a enviar quer
 * ver a hora do segundo envio. O `groupBy` é por coluna real, não por ordinal —
 * agrupar por posição rebenta com 42803 assim que a expressão de cima deixa de
 * ser uma coluna simples.
 */
async function confirmacoesEnviadas(ids: readonly string[]): Promise<Map<string, Date>> {
  if (ids.length === 0) return new Map()

  const linhas = await db
    .select({
      refId: notificationLogs.refId,
      enviadaEm: sql<Date>`max(${notificationLogs.sentAt})`,
    })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.refType, 'appointment'),
        inArray(notificationLogs.refId, [...ids]),
        eq(notificationLogs.templateKey, 'confirmacao'),
        eq(notificationLogs.status, 'sent'),
      ),
    )
    .groupBy(notificationLogs.refId)

  /* `refId` é nulável no schema — há registos que não apontam a nada (avisos
     de sistema). O `inArray` já os exclui; o filtro é só para o tipo. */
  const mapa = new Map<string, Date>()
  for (const linha of linhas) {
    if (linha.refId !== null) mapa.set(linha.refId, linha.enviadaEm)
  }
  return mapa
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

/**
 * Os estados que já não ocupam horário: desmarcado dos dois lados, e a falta.
 *
 * Vive aqui e não em cada tela porque eram três cópias do mesmo conjunto — o
 * contador, a agenda de uma loja e a das lojas todas. Um estado que entra numa
 * lista e não na outra é a agenda a dizer dois números diferentes para o mesmo
 * dia, e quem trabalha nela deixa de acreditar nos dois.
 */
export const CANCELADOS: ReadonlySet<string> = new Set([
  'cancelled_by_client',
  'cancelled_by_studio',
  'no_show',
])

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
  let counters: DayCounters = {
    total: list.length,
    reserved: 0,
    completed: 0,
    cancelled: 0,
    revenue: 0,
    expected: 0,
  }

  for (const item of list) {
    if (CANCELADOS.has(item.status)) {
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
 * Os atendimentos em que esta profissional executa pelo menos um serviço.
 *
 * O recorte é por atendimento, não por coluna: a cliente que fez escova com uma
 * e coloração com outra aparece inteira para as duas — é o mesmo horário, e
 * esconder metade dele faria a agenda mentir sobre quando ela sai.
 *
 * Vive aqui, e não na tela, porque são duas telas a fazer o mesmo recorte: a
 * agenda de uma loja e a das lojas todas. Uma cópia divergente seria uma delas
 * a mostrar-lhe a agenda da colega.
 */
export function soDaProfissional(
  list: readonly AppointmentView[],
  staffId: string | null,
): AppointmentView[] {
  /* Sem perfil de agenda não há coluna nem atendimento — lista vazia é a
     resposta honesta, e não "então mostra tudo". */
  if (!staffId) return []
  return list.filter((item) => item.items.some((entry) => entry.staffId === staffId))
}
