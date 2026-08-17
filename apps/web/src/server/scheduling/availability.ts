import 'server-only'

/**
 * Consulta de horários livres.
 *
 * Fina de propósito: monta o contexto, chama o motor puro de `@studio/core` e
 * devolve o resultado com preço já resolvido. Nenhuma regra de agenda vive
 * aqui — se precisar mexer em como o horário é calculado, o lugar é o motor.
 */

import {
  addDaysInZone,
  checkLead,
  findAvailableSlots,
  isoDateInZone,
  planVisitAt,
  resolvePrice,
  type AvailabilityQuery,
  type LeadCheck,
  type Slot,
  type StaffPickStrategy,
} from '@studio/core'
import {
  getUnitBySlug,
  loadBookingContext,
  type BookingContext,
  type ServiceInfo,
  type UnitInfo,
} from './context'

export interface CartInput {
  serviceId: string
  /** Ausente = "sem preferência de profissional". */
  staffId?: string
}

export interface DayQuery {
  unitSlug: string
  /** Data de parede `YYYY-MM-DD` na timezone da unidade. */
  date: string
  cart: readonly CartInput[]
  /** Só considera profissionais habilitados para agendamento online. */
  onlineOnly?: boolean
  strategy?: StaffPickStrategy
  /** Ignora a ocupação deste agendamento — usado ao remarcar. */
  excludeAppointmentId?: string
  /** Regras de antecedência desligadas: a recepção encaixa fora delas. */
  ignoreLeadRules?: boolean
  /**
   * Minutos de atraso que a gravação ainda aceita, só com `ignoreLeadRules`.
   *
   * A lista do encaixe fica em zero de propósito — mostrar as horas de hoje
   * que já passaram só enchia o ecrã. Mas entre ver o horário e escrever o
   * nome da cliente passam minutos, e às vezes a hora vira: sem esta folga, a
   * recepção levava com «já não está a tempo» ao carregar em gravar.
   */
  atrasoTolerado?: number
  limit?: number
  now?: Date
}

export interface SlotOption {
  /** ISO do início — é este valor que volta na confirmação. */
  start: string
  end: string
  totalDurationMin: number
  totalPrice: number
  items: {
    serviceId: string
    serviceName: string
    staffId: string
    staffName: string
    start: string
    end: string
    price: number
  }[]
}

export interface DayAvailability {
  unit: UnitInfo
  date: string
  /** Vazio quando a unidade não abre no dia. */
  slots: SlotOption[]
  closed: boolean
}

/** Contexto de um único dia — o caso comum das telas de agendamento. */
export async function loadDayContext(
  unitSlug: string,
  date: string,
  excludeAppointmentId?: string,
): Promise<{ unit: UnitInfo; ctx: BookingContext } | null> {
  const unit = await getUnitBySlug(unitSlug)
  if (!unit) return null
  const ctx = await loadBookingContext({
    unit,
    fromDate: date,
    toDate: date,
    ...(excludeAppointmentId ? { excludeAppointmentId } : {}),
  })
  return { unit, ctx }
}

export async function findSlotsForDay(query: DayQuery): Promise<DayAvailability | null> {
  const loaded = await loadDayContext(query.unitSlug, query.date, query.excludeAppointmentId)
  if (!loaded) return null
  const { unit, ctx } = loaded

  if (ctx.openRanges.length === 0) {
    return { unit, date: query.date, slots: [], closed: true }
  }

  const slots = findAvailableSlots(buildQuery(ctx, query))
  return {
    unit,
    date: query.date,
    slots: slots.map((slot) => describeSlot(ctx, slot)),
    closed: false,
  }
}

/**
 * Varre um contexto já carregado. Usado quando a tela precisa de vários dias de
 * uma vez — carregar o contexto uma vez e varrer é muito mais barato que uma
 * consulta por dia.
 */
export function findSlots(
  ctx: BookingContext,
  query: Omit<DayQuery, 'unitSlug' | 'date'>,
): SlotOption[] {
  if (ctx.openRanges.length === 0) return []
  return findAvailableSlots(buildQuery(ctx, query)).map((slot) => describeSlot(ctx, slot))
}

/**
 * Valida um horário específico. Usado na confirmação: o cliente manda só o
 * instante, e é o servidor que replaneja quem faz o quê e em qual recurso.
 */
export function planAt(ctx: BookingContext, query: Omit<DayQuery, 'unitSlug' | 'date'>, start: Date): Slot | null {
  return planVisitAt(buildQuery(ctx, query), start)
}

/**
 * A antecedência do horário pedido, com o motivo.
 *
 * `planAt` devolve só `null`, e quem confirma precisa de saber se o horário
 * está ocupado ou se já passou — são frases diferentes no ecrã da cliente.
 */
export function checkLeadAt(
  ctx: BookingContext,
  query: Omit<DayQuery, 'unitSlug' | 'date'>,
  start: Date,
): LeadCheck {
  return checkLead(buildQuery(ctx, query), start)
}

function buildQuery(
  ctx: BookingContext,
  query: Omit<DayQuery, 'unitSlug' | 'date'> & { now?: Date },
): AvailabilityQuery {
  const specs: Record<string, ReturnType<typeof serviceSpec>> = {}
  for (const [id, service] of ctx.services) specs[id] = serviceSpec(service)

  const settings = ctx.unit.settings
  return {
    unitOpenRanges: ctx.openRanges,
    cart: query.cart.map((item) => ({
      serviceId: item.serviceId,
      ...(item.staffId ? { staffId: item.staffId } : {}),
    })),
    services: specs,
    staff: ctx.staff,
    resources: ctx.resources,
    granularityMin: settings.granularityMin,
    now: query.now ?? new Date(),
    minLeadMin: query.ignoreLeadRules ? -(query.atrasoTolerado ?? 0) : settings.minLeadMin,
    maxLeadDays: query.ignoreLeadRules ? 3650 : settings.maxLeadDays,
    interServiceGapMin: settings.interServiceGapMin,
    staffPickStrategy: query.strategy ?? 'balanced',
    ...(query.onlineOnly ? { onlineOnly: true } : {}),
    ...(query.limit ? { limit: query.limit } : {}),
  }
}

function serviceSpec(service: ServiceInfo) {
  return service.spec
}

/** Anexa nome e preço ao que o motor devolveu, para a tela não consultar de novo. */
export function describeSlot(ctx: BookingContext, slot: Slot): SlotOption {
  const items = slot.items.map((item) => {
    const service = ctx.services.get(item.serviceId)
    const { price } = resolvePrice(ctx.priceOverrides, {
      serviceId: item.serviceId,
      unitId: ctx.unit.id,
      staffId: item.staffId,
      basePrice: service?.basePrice ?? 0,
      baseDurationMin: service?.clientDurationMin ?? 0,
    })
    return {
      serviceId: item.serviceId,
      serviceName: service?.name ?? 'Serviço',
      staffId: item.staffId,
      staffName: ctx.staffInfo.get(item.staffId)?.name ?? 'Profissional',
      start: item.start.toISOString(),
      end: item.end.toISOString(),
      price,
    }
  })

  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    totalDurationMin: slot.totalDurationMin,
    totalPrice: items.reduce((sum, item) => sum + item.price, 0),
    items,
  }
}

/** Data de parede de hoje na unidade. */
export function todayInUnit(unit: UnitInfo, now = new Date()): string {
  return isoDateInZone(now, unit.timezone)
}
