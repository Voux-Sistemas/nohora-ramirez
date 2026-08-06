/**
 * Geração da agenda fictícia.
 *
 * A agenda NÃO é preenchida na marra: cada visita é planejada pelo mesmo motor
 * de disponibilidade que o app usa em produção (`findAvailableSlots`). Isso dá
 * duas coisas de graça — a agenda gerada é fisicamente possível, e o seed vira
 * um teste de esforço do motor: se ele produzir sobreposição, a constraint de
 * exclusão do Postgres derruba o seed na hora.
 */

import {
  findAvailableSlots,
  intersectRanges,
  resolvePrice,
  zonedDateTime,
  type AvailabilityQuery,
  type PriceOverride,
  type ResourceAvailability,
  type ServiceSpec,
  type Slot,
  type StaffAvailability,
  type TimeRange,
} from '@studio/core'
import type { Rng } from './rng'

export interface UnitCtx {
  id: string
  slug: string
  timezone: string
  hours: readonly (readonly [number, string, string])[]
  granularityMin: number
}

export interface ServiceCtx {
  id: string
  slug: string
  spec: ServiceSpec
  basePrice: number
  baseDurationMin: number
  onlineBookable: boolean
  deposit: { type: 'percent'; bps: number } | { type: 'fixed'; cents: number } | null
}

export interface StaffCtx {
  id: string
  slug: string
  units: readonly string[]
  skills: readonly string[]
  acceptsOnlineBooking: boolean
  schedule: Readonly<Record<string, readonly (readonly [number, string, string])[]>>
}

export interface ResourceCtx {
  id: string
  resourceTypeId: string
}

export interface ClientCtx {
  /** id do `client_profiles`, não do `users` */
  id: string
  userId: string
  preferredUnit?: string
  preferredStaff?: string
}

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled_by_client'
  | 'cancelled_by_studio'
  | 'no_show'

export type AppointmentSource =
  | 'client_app'
  | 'reception'
  | 'whatsapp'
  | 'phone'
  | 'walk_in'
  | 'recurrence'

/** Uma visita pronta para virar linhas no banco. */
export interface PlannedAppointment {
  unitId: string
  clientId: string
  slot: Slot
  status: AppointmentStatus
  source: AppointmentSource
  totalPrice: number
  depositRequired: number
  /** Preço congelado por item, na ordem de `slot.items`. */
  itemPrices: readonly { price: number; durationMin: number }[]
  clientNote?: string
  /** Cancelada/faltou não reserva horário — as linhas de bloqueio não são criadas. */
  reservesTime: boolean
  cancellationReason?: string
}

/** Combos que aparecem juntos de verdade numa visita. */
const COMBOS: Readonly<Record<string, readonly string[]>> = {
  manicure: ['pedicure'],
  'corte-fem': ['hidratacao', 'escova'],
  coloracao: ['corte-fem'],
  mechas: ['corte-fem'],
  escova: ['sobrancelha'],
  sobrancelha: ['manicure'],
}

const NOTAS_CLIENTE = [
  'Vou chegar 10 minutinhos atrasada.',
  'Prefiro café sem açúcar :)',
  'Pode ser com a mesma profissional da última vez?',
  'É para um casamento no fim de semana.',
  'Estou com o couro cabeludo sensível.',
]

export interface GenerateOptions {
  rng: Rng
  units: readonly UnitCtx[]
  services: readonly ServiceCtx[]
  staff: readonly StaffCtx[]
  resourcesByUnit: ReadonlyMap<string, readonly ResourceCtx[]>
  clients: readonly ClientCtx[]
  priceOverrides: readonly PriceOverride[]
  /** Data de parede do primeiro dia gerado, `YYYY-MM-DD`. */
  fromDate: string
  /** Quantos dias gerar a partir de `fromDate`. */
  days: number
  /** Data de parede de hoje — separa passado de futuro. */
  today: string
  /** Instante de referência, para decidir o que já aconteceu hoje. */
  now: Date
}

export function generateAppointments(options: GenerateOptions): PlannedAppointment[] {
  const { rng, units, services, staff, resourcesByUnit, clients, priceOverrides } = options
  const serviceBySlug = new Map(services.map((s) => [s.slug, s]))
  const specById: Record<string, ServiceSpec> = {}
  for (const service of services) specById[service.id] = service.spec

  const planned: PlannedAppointment[] = []

  for (const unit of units) {
    const resources = resourcesByUnit.get(unit.slug) ?? []
    const resourceTypesPresent = new Set(resources.map((r) => r.resourceTypeId))

    for (let dayOffset = 0; dayOffset < options.days; dayOffset++) {
      const date = addDays(options.fromDate, dayOffset)
      const weekday = weekdayOf(date)

      const openRanges = unit.hours
        .filter(([wd]) => wd === weekday)
        .map(([, opens, closes]) => ({
          start: zonedDateTime(date, opens, unit.timezone),
          end: zonedDateTime(date, closes, unit.timezone),
        }))
      if (openRanges.length === 0) continue

      // escala do dia, já recortada pelo horário da unidade
      const busyByStaff = new Map<string, TimeRange[]>()
      const working = new Map<string, TimeRange[]>()
      const dayStaff = staff.filter((person) => {
        const shifts = person.schedule[unit.slug]?.filter(([wd]) => wd === weekday) ?? []
        if (shifts.length === 0) return false
        const ranges = intersectRanges(
          shifts.map(([, entra, sai]) => ({
            start: zonedDateTime(date, entra, unit.timezone),
            end: zonedDateTime(date, sai, unit.timezone),
          })),
          openRanges,
        )
        if (ranges.length === 0) return false
        working.set(person.id, ranges)
        busyByStaff.set(person.id, [])
        return true
      })
      if (dayStaff.length === 0) continue

      const busyByResource = new Map<string, TimeRange[]>(resources.map((r) => [r.id, []]))

      // serviços que esta unidade consegue entregar hoje
      const doable = services.filter((service) => {
        const hasResource = service.spec.requiredResourceTypeIds.every((t) =>
          resourceTypesPresent.has(t),
        )
        const hasStaff = dayStaff.some((p) => p.skills.includes(service.slug))
        return hasResource && hasStaff
      })
      if (doable.length === 0) continue

      const fill = fillRate(date, options.today, rng)
      const attempts = dayStaff.length * 6

      for (let attempt = 0; attempt < attempts; attempt++) {
        if (!rng.bool(fill)) continue

        const client = pickClient(rng, clients, unit.slug)
        const cart = buildCart(rng, doable, serviceBySlug, dayStaff)
        if (cart.length === 0) continue

        // cliente com profissional favorito costuma insistir nele
        const preferred = dayStaff.find((p) => p.slug === client.preferredStaff)
        const wantsPreferred =
          preferred !== undefined &&
          cart.every((service) => preferred.skills.includes(service.slug)) &&
          rng.bool(0.7)

        const query: AvailabilityQuery = {
          unitOpenRanges: openRanges,
          cart: cart.map((service) => ({
            serviceId: service.id,
            ...(wantsPreferred ? { staffId: preferred.id } : {}),
          })),
          services: specById,
          staff: dayStaff.map<StaffAvailability>((person) => ({
            staffId: person.id,
            skillServiceIds: person.skills
              .map((slug) => serviceBySlug.get(slug)?.id)
              .filter((id): id is string => id !== undefined),
            workingRanges: working.get(person.id) ?? [],
            busyRanges: busyByStaff.get(person.id) ?? [],
            acceptsOnlineBooking: person.acceptsOnlineBooking,
          })),
          resources: resources.map<ResourceAvailability>((resource) => ({
            resourceId: resource.id,
            resourceTypeId: resource.resourceTypeId,
            busyRanges: busyByResource.get(resource.id) ?? [],
          })),
          granularityMin: unit.granularityMin,
          // o motor não deve filtrar por antecedência ao popular o passado
          now: new Date(openRanges[0]!.start.getTime() - 86_400_000),
          minLeadMin: 0,
          maxLeadDays: 3,
          staffPickStrategy: 'balanced',
        }

        const slots = findAvailableSlots(query)
        if (slots.length === 0) continue

        // prefere horário comercial cheio a sobra de fim de expediente
        const slot = rng.pick(slots.slice(0, Math.max(1, Math.ceil(slots.length * 0.8))))

        const status = pickStatus(rng, date, options.today, slot.start, options.now)
        const reservesTime = !isCancelled(status)

        const itemPrices = slot.items.map((item) => {
          const service = services.find((s) => s.id === item.serviceId)!
          return resolvePrice(priceOverrides, {
            serviceId: service.id,
            unitId: unit.id,
            staffId: item.staffId,
            basePrice: service.basePrice,
            baseDurationMin: service.baseDurationMin,
          })
        })
        const totalPrice = itemPrices.reduce((sum, p) => sum + p.price, 0)

        const depositService = cart.find((service) => service.deposit !== null)
        const depositRequired = depositService?.deposit
          ? depositService.deposit.type === 'percent'
            ? Math.round((totalPrice * depositService.deposit.bps) / 10_000)
            : depositService.deposit.cents
          : 0

        planned.push({
          unitId: unit.id,
          clientId: client.id,
          slot,
          status,
          source: pickSource(rng, cart.some((s) => !s.onlineBookable)),
          totalPrice,
          depositRequired,
          itemPrices: itemPrices.map((p) => ({ price: p.price, durationMin: p.durationMin })),
          reservesTime,
          ...(rng.bool(0.12) ? { clientNote: rng.pick(NOTAS_CLIENTE) } : {}),
          ...(isCancelled(status)
            ? { cancellationReason: cancellationReason(rng, status) }
            : {}),
        })

        if (reservesTime) {
          for (const item of slot.items) {
            busyByStaff.get(item.staffId)?.push(...item.staffBusy)
            for (const resourceId of item.resourceIds) {
              busyByResource.get(resourceId)?.push(item.resourceBusy)
            }
          }
        }
      }
    }
  }

  return planned
}

// ─── escolhas ───────────────────────────────────────────────────────────────

function pickClient(rng: Rng, clients: readonly ClientCtx[], unitSlug: string): ClientCtx {
  // quem tem unidade preferida volta nela; o resto circula
  return rng.weighted(clients.map((c) => [c, c.preferredUnit === unitSlug ? 6 : 1] as const))
}

function buildCart(
  rng: Rng,
  doable: readonly ServiceCtx[],
  bySlug: ReadonlyMap<string, ServiceCtx>,
  dayStaff: readonly StaffCtx[],
): ServiceCtx[] {
  const first = rng.pick(doable)
  const cart = [first]

  if (rng.bool(0.22)) {
    const candidates = (COMBOS[first.slug] ?? [])
      .map((slug) => bySlug.get(slug))
      .filter((service): service is ServiceCtx => {
        if (!service) return false
        if (!doable.includes(service)) return false
        return dayStaff.some((p) => p.skills.includes(service.slug))
      })
    if (candidates.length > 0) cart.push(rng.pick(candidates))
  }

  return cart
}

function pickSource(rng: Rng, forcedOffline: boolean): AppointmentSource {
  if (forcedOffline) return rng.weighted([['reception', 6], ['phone', 3], ['walk_in', 1]] as const)
  return rng.weighted([
    ['client_app', 10],
    ['reception', 5],
    ['whatsapp', 3],
    ['phone', 2],
    ['walk_in', 1],
    ['recurrence', 1],
  ] as const)
}

function pickStatus(
  rng: Rng,
  date: string,
  today: string,
  start: Date,
  now: Date,
): AppointmentStatus {
  if (date < today) {
    return rng.weighted([
      ['completed', 86],
      ['cancelled_by_client', 7],
      ['no_show', 4],
      ['cancelled_by_studio', 3],
    ] as const)
  }

  if (date === today) {
    if (start.getTime() < now.getTime() - 3600_000) return 'completed'
    if (start.getTime() < now.getTime()) return rng.weighted([['in_progress', 3], ['completed', 1]] as const)
    if (start.getTime() < now.getTime() + 1800_000) return 'checked_in'
    return rng.weighted([['confirmed', 7], ['scheduled', 3]] as const)
  }

  return rng.weighted([
    ['confirmed', 55],
    ['scheduled', 40],
    ['cancelled_by_client', 5],
  ] as const)
}

function isCancelled(status: AppointmentStatus): boolean {
  return (
    status === 'cancelled_by_client' ||
    status === 'cancelled_by_studio' ||
    status === 'no_show'
  )
}

function cancellationReason(rng: Rng, status: AppointmentStatus): string {
  if (status === 'no_show') return 'Cliente não compareceu e não avisou'
  if (status === 'cancelled_by_studio') {
    return rng.pick(['Profissional adoeceu', 'Falta de energia na unidade', 'Remanejamento de agenda'])
  }
  return rng.pick([
    'Imprevisto de trabalho',
    'Remarcou para a semana que vem',
    'Ficou doente',
    'Não informado',
  ])
}

/** Quão cheia a agenda fica: passado lota, futuro distante ainda tem espaço. */
function fillRate(date: string, today: string, rng: Rng): number {
  const distance = daysBetween(today, date)
  const base =
    distance < 0 ? 0.72 : distance <= 3 ? 0.62 : distance <= 10 ? 0.45 : distance <= 20 ? 0.3 : 0.16
  // variação de dia para dia — agenda real não é uniforme
  return Math.max(0.05, base + (rng.next() - 0.5) * 0.18)
}

// ─── datas de parede ────────────────────────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return shifted.toISOString().slice(0, 10)
}

function weekdayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}
