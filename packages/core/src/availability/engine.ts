import {
  addMinutes,
  contains,
  containedInAny,
  durationMin,
  mergeRanges,
  overlapsAny,
  subtractRanges,
  totalMinutes,
  type TimeRange,
} from '../time/range.js'
import type {
  AvailabilityQuery,
  CartItem,
  PlannedItem,
  ResourceAvailability,
  ServiceSpec,
  Slot,
  StaffAvailability,
  StaffPickStrategy,
} from './types.js'

const DEFAULT_LIMIT = 200

/**
 * Regras de checagem (documentadas porque não são óbvias):
 *
 * 1. Horário de funcionamento e escala são verificados contra o intervalo
 *    VISÍVEL do serviço (sem buffer). O buffer é preparo/limpeza e pode
 *    encostar na borda do turno.
 * 2. Conflito com outros atendimentos é verificado contra o intervalo COM
 *    buffer — é essa a função do buffer.
 * 3. O profissional só é bloqueado na aplicação e na finalização. O
 *    processamento devolve o profissional para a grade (gap booking).
 * 4. O recurso (cabine, lavatório) fica bloqueado do início ao fim, inclusive
 *    durante o processamento.
 * 5. Buffers valem apenas nas bordas da visita. Entre dois serviços do mesmo
 *    cliente usa-se `interServiceGapMin`, porque não há troca de cliente.
 */

export class AvailabilityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AvailabilityError'
  }
}

interface ItemLayout {
  readonly serviceId: string
  readonly clientRange: TimeRange
  /** Blocos do profissional sem buffer — usados para checar escala. */
  readonly activeBlocks: readonly TimeRange[]
  /** Blocos do profissional com buffer — usados para checar conflito. */
  readonly blockedBlocks: readonly TimeRange[]
  /** Ocupação do recurso, com buffer. */
  readonly resourceRange: TimeRange
}

/** Monta o layout temporal de um serviço começando em `start`. */
function layoutService(
  spec: ServiceSpec,
  start: Date,
  applyBufferBefore: boolean,
  applyBufferAfter: boolean,
): ItemLayout {
  const { setupMin, processingMin, finishMin, bufferBeforeMin, bufferAfterMin } = spec.duration

  const setupEnd = addMinutes(start, setupMin)
  const processingEnd = addMinutes(setupEnd, processingMin)
  const clientEnd = addMinutes(processingEnd, finishMin)

  const before = applyBufferBefore ? bufferBeforeMin : 0
  const after = applyBufferAfter ? bufferAfterMin : 0

  const active: TimeRange[] = []
  const blocked: TimeRange[] = []

  if (processingMin > 0 && setupMin > 0 && finishMin > 0) {
    // caso clássico da química: dois blocos com o profissional livre no meio
    active.push({ start, end: setupEnd }, { start: processingEnd, end: clientEnd })
    blocked.push(
      { start: addMinutes(start, -before), end: setupEnd },
      { start: processingEnd, end: addMinutes(clientEnd, after) },
    )
  } else {
    // sem processamento (ou sem aplicação/finalização): um bloco contínuo
    active.push({ start, end: clientEnd })
    blocked.push({ start: addMinutes(start, -before), end: addMinutes(clientEnd, after) })
  }

  return {
    serviceId: spec.serviceId,
    clientRange: { start, end: clientEnd },
    activeBlocks: active.filter((r) => r.end > r.start),
    blockedBlocks: blocked.filter((r) => r.end > r.start),
    resourceRange: {
      start: addMinutes(start, -before),
      end: addMinutes(clientEnd, after),
    },
  }
}

export function serviceClientDurationMin(spec: ServiceSpec): number {
  const { setupMin, processingMin, finishMin } = spec.duration
  return setupMin + processingMin + finishMin
}

/** Duração total da visita, do ponto de vista do cliente. */
export function cartDurationMin(
  cart: readonly CartItem[],
  services: Readonly<Record<string, ServiceSpec>>,
  interServiceGapMin = 0,
): number {
  return cart.reduce((total, item, index) => {
    const spec = services[item.serviceId]
    if (!spec) throw new AvailabilityError(`Serviço desconhecido: ${item.serviceId}`)
    const gap = index > 0 ? interServiceGapMin : 0
    return total + gap + serviceClientDurationMin(spec)
  }, 0)
}

function eligibleStaff(
  item: CartItem,
  staff: readonly StaffAvailability[],
  onlineOnly: boolean,
): StaffAvailability[] {
  return staff.filter((candidate) => {
    if (item.staffId && candidate.staffId !== item.staffId) return false
    if (!candidate.skillServiceIds.includes(item.serviceId)) return false
    if (onlineOnly && candidate.acceptsOnlineBooking === false) return false
    return true
  })
}

function gapScore(candidate: StaffAvailability, at: Date): number {
  const t = at.getTime()
  let best = Number.POSITIVE_INFINITY
  for (const busy of candidate.busyRanges) {
    best = Math.min(best, Math.abs(t - busy.end.getTime()), Math.abs(busy.start.getTime() - t))
  }
  return best
}

function orderStaff(
  candidates: StaffAvailability[],
  strategy: StaffPickStrategy,
  at: Date,
): StaffAvailability[] {
  if (strategy === 'first-available') return candidates
  const sorted = [...candidates]
  if (strategy === 'balanced') {
    sorted.sort((a, b) => totalMinutes(a.busyRanges) - totalMinutes(b.busyRanges))
  } else {
    sorted.sort((a, b) => gapScore(a, at) - gapScore(b, at))
  }
  return sorted
}

interface PlanningState {
  /** Ocupações já reservadas dentro DESTA visita, por profissional. */
  readonly staffHolds: Map<string, TimeRange[]>
  /** Recursos já reservados dentro DESTA visita. */
  readonly resourceHolds: Map<string, TimeRange[]>
}

function staffFits(
  candidate: StaffAvailability,
  layout: ItemLayout,
  state: PlanningState,
): boolean {
  const working = mergeRanges(candidate.workingRanges)

  // 1. os blocos ativos precisam caber na escala do profissional
  for (const block of layout.activeBlocks) {
    if (!containedInAny(block, working)) return false
  }

  // 2. os blocos com buffer não podem colidir com nada já ocupado
  const held = state.staffHolds.get(candidate.staffId) ?? []
  const occupied = [...candidate.busyRanges, ...held]
  for (const block of layout.blockedBlocks) {
    if (overlapsAny(block, occupied)) return false
  }

  return true
}

function pickResources(
  spec: ServiceSpec,
  layout: ItemLayout,
  resources: readonly ResourceAvailability[],
  state: PlanningState,
): string[] | null {
  const picked: string[] = []

  for (const typeId of spec.requiredResourceTypeIds) {
    const free = resources.find((resource) => {
      if (resource.resourceTypeId !== typeId) return false
      if (picked.includes(resource.resourceId)) return false
      const held = state.resourceHolds.get(resource.resourceId) ?? []
      return !overlapsAny(layout.resourceRange, [...resource.busyRanges, ...held])
    })
    if (!free) return null
    picked.push(free.resourceId)
  }

  return picked
}

/**
 * Tenta montar a visita inteira começando exatamente em `start`.
 * Devolve o slot planejado ou `null` se não couber.
 *
 * Também é a função usada na hora de confirmar um agendamento: o servidor
 * revalida o horário escolhido antes de gravar, e o banco dá a palavra final
 * através da constraint de exclusão.
 */
export function planVisitAt(query: AvailabilityQuery, start: Date): Slot | null {
  const {
    cart,
    services,
    staff,
    resources,
    unitOpenRanges,
    interServiceGapMin = 0,
    staffPickStrategy = 'balanced',
    onlineOnly = false,
  } = query

  if (cart.length === 0) throw new AvailabilityError('Carrinho vazio')

  const visitDuration = cartDurationMin(cart, services, interServiceGapMin)
  const visitRange: TimeRange = { start, end: addMinutes(start, visitDuration) }

  // a visita inteira precisa caber numa única janela de funcionamento
  const openWindow = mergeRanges(unitOpenRanges).find((window) => contains(window, visitRange))
  if (!openWindow) return null

  const state: PlanningState = { staffHolds: new Map(), resourceHolds: new Map() }
  const items: PlannedItem[] = []

  let cursor = start

  for (let index = 0; index < cart.length; index++) {
    const item = cart[index]!
    const spec = services[item.serviceId]
    if (!spec) throw new AvailabilityError(`Serviço desconhecido: ${item.serviceId}`)

    const layout = layoutService(spec, cursor, index === 0, index === cart.length - 1)

    const candidates = orderStaff(
      eligibleStaff(item, staff, onlineOnly),
      staffPickStrategy,
      cursor,
    )
    if (candidates.length === 0) return null

    let placed: PlannedItem | null = null

    for (const candidate of candidates) {
      if (!staffFits(candidate, layout, state)) continue
      const resourceIds = pickResources(spec, layout, resources, state)
      if (!resourceIds) continue

      placed = {
        serviceId: spec.serviceId,
        staffId: candidate.staffId,
        resourceIds,
        start: layout.clientRange.start,
        end: layout.clientRange.end,
        staffBusy: layout.blockedBlocks,
        resourceBusy: layout.resourceRange,
      }

      // reserva dentro desta visita para os próximos serviços não reusarem
      const holds = state.staffHolds.get(candidate.staffId) ?? []
      state.staffHolds.set(candidate.staffId, [...holds, ...layout.blockedBlocks])
      for (const resourceId of resourceIds) {
        const resourceHolds = state.resourceHolds.get(resourceId) ?? []
        state.resourceHolds.set(resourceId, [...resourceHolds, layout.resourceRange])
      }
      break
    }

    if (!placed) return null

    items.push(placed)
    cursor = addMinutes(placed.end, interServiceGapMin)
  }

  const first = items[0]!
  const last = items[items.length - 1]!

  return {
    start: first.start,
    end: last.end,
    totalDurationMin: durationMin({ start: first.start, end: last.end }),
    items,
  }
}

/**
 * Varre a grade e devolve todos os horários em que a visita cabe.
 */
export function findAvailableSlots(query: AvailabilityQuery): Slot[] {
  const {
    cart,
    services,
    unitOpenRanges,
    granularityMin,
    now,
    minLeadMin = 0,
    maxLeadDays,
    interServiceGapMin = 0,
    limit = DEFAULT_LIMIT,
  } = query

  if (cart.length === 0) throw new AvailabilityError('Carrinho vazio')
  if (granularityMin <= 0) throw new AvailabilityError('Granularidade precisa ser positiva')

  const visitDuration = cartDurationMin(cart, services, interServiceGapMin)
  if (visitDuration <= 0) throw new AvailabilityError('Duração total da visita é zero')

  const earliest = addMinutes(now, minLeadMin)
  const latest = maxLeadDays === undefined ? null : addMinutes(now, maxLeadDays * 24 * 60)

  const slots: Slot[] = []

  for (const window of mergeRanges(unitOpenRanges)) {
    let candidate = window.start

    while (addMinutes(candidate, visitDuration).getTime() <= window.end.getTime()) {
      if (slots.length >= limit) return slots

      const withinLead =
        candidate.getTime() >= earliest.getTime() &&
        (latest === null || candidate.getTime() <= latest.getTime())

      if (withinLead) {
        const slot = planVisitAt(query, candidate)
        if (slot) slots.push(slot)
      }

      candidate = addMinutes(candidate, granularityMin)
    }
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Janelas realmente livres de um profissional — escala menos ocupações.
 * Útil para desenhar a agenda e para medir ociosidade.
 */
export function staffFreeWindows(staff: StaffAvailability): TimeRange[] {
  return subtractRanges(staff.workingRanges, staff.busyRanges)
}

/** Taxa de ocupação do profissional no período, entre 0 e 1. */
export function staffOccupancyRate(staff: StaffAvailability): number {
  const scheduled = totalMinutes(staff.workingRanges)
  if (scheduled === 0) return 0
  const busy = totalMinutes(staff.busyRanges)
  return Math.min(1, busy / scheduled)
}
