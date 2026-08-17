import 'server-only'

/**
 * Escrita da agenda.
 *
 * Regra que não se negocia: quem agenda manda apenas o INSTANTE desejado e o
 * carrinho. Quem decide profissional, recurso e blocos é o servidor, replanejando
 * do zero com `planVisitAt`. Nada de aceitar horário de bloco vindo do navegador.
 *
 * A garantia final contra corrida não é o replanejamento — é a constraint de
 * exclusão do Postgres. Duas requisições simultâneas passam pelo mesmo
 * planejamento e uma delas leva 23P01 no INSERT; traduzimos isso para "esse
 * horário acabou de ser ocupado".
 */

import { depositAmount, isoDateInZone, resolvePrice, type Slot } from '@studio/core'
import {
  appointmentItems,
  appointmentResourceBlocks,
  appointmentStaffBlocks,
  appointmentStatusEvents,
  appointments,
  clientProfiles,
  toRange,
  type Database,
} from '@studio/db'
import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { describeSlot, planAt, type CartInput, type SlotOption } from './availability'
import { getUnitBySlug, loadBookingContext, type BookingContext } from './context'

/** A transação do Drizzle tem a mesma superfície do banco para o que usamos. */
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0]

export type BookingChannel = 'online' | 'reception'

export type AppointmentSource =
  | 'client_app'
  | 'reception'
  | 'whatsapp'
  | 'phone'
  | 'walk_in'
  | 'recurrence'

export interface CreateAppointmentInput {
  unitSlug: string
  /** `client_profiles.id` — não é o id do usuário. */
  clientId: string
  cart: readonly CartInput[]
  /** Instante do início, ISO 8601. */
  start: string
  source: AppointmentSource
  channel: BookingChannel
  clientNote?: string
  internalNote?: string
  /** `users.id` de quem está criando, quando é a recepção. */
  actorId?: string
}

export type BookingError =
  | 'unit_not_found'
  | 'empty_cart'
  | 'invalid_start'
  | 'service_unavailable'
  | 'not_online_bookable'
  | 'requires_assessment'
  | 'slot_taken'

export type CreateAppointmentResult =
  | { ok: true; appointmentId: string; slot: SlotOption; depositRequired: number }
  | { ok: false; error: BookingError; message: string }

const MESSAGES: Record<BookingError, string> = {
  unit_not_found: 'Unidade não encontrada.',
  empty_cart: 'Escolha pelo menos um serviço.',
  invalid_start: 'Horário inválido.',
  service_unavailable: 'Este serviço não está disponível nesta unidade.',
  not_online_bookable: 'Este serviço só pode ser marcado pela receção.',
  requires_assessment: 'Este procedimento exige avaliação presencial antes de marcar.',
  slot_taken: 'Este horário acabou de ser ocupado. Escolha outro, por favor.',
}

function fail(error: BookingError): CreateAppointmentResult {
  return { ok: false, error, message: MESSAGES[error] }
}

// ─── planejamento ───────────────────────────────────────────────────────────

interface Plan {
  ctx: BookingContext
  slot: Slot
  itemPrices: number[]
  itemDurations: number[]
  totalPrice: number
  depositRequired: number
}

/**
 * Replaneja a visita a partir do estado atual do banco e congela os preços.
 * Separado da escrita para que remarcação possa validar antes de mexer em nada.
 */
async function planBooking(
  input: CreateAppointmentInput,
  excludeAppointmentId?: string,
): Promise<Plan | BookingError> {
  if (input.cart.length === 0) return 'empty_cart'

  const start = new Date(input.start)
  if (Number.isNaN(start.getTime())) return 'invalid_start'

  const unit = await getUnitBySlug(input.unitSlug)
  if (!unit) return 'unit_not_found'

  const date = isoDateInZone(start, unit.timezone)
  const ctx = await loadBookingContext({
    unit,
    fromDate: date,
    toDate: date,
    ...(excludeAppointmentId ? { excludeAppointmentId } : {}),
  })

  const online = input.channel === 'online'
  for (const item of input.cart) {
    const service = ctx.services.get(item.serviceId)
    if (!service) return 'service_unavailable'
    if (online && !service.onlineBookable) return 'not_online_bookable'
    if (online && service.requiresAssessment) return 'requires_assessment'
  }

  const slot = planAt(
    ctx,
    {
      cart: input.cart,
      // a recepção encaixa fora das regras de antecedência; o cliente, não
      ...(online ? { onlineOnly: true } : { ignoreLeadRules: true }),
    },
    start,
  )
  if (!slot) return 'slot_taken'

  const itemPrices: number[] = []
  const itemDurations: number[] = []
  let depositRequired = 0

  for (const item of slot.items) {
    const service = ctx.services.get(item.serviceId)
    const resolved = resolvePrice(ctx.priceOverrides, {
      serviceId: item.serviceId,
      unitId: ctx.unit.id,
      staffId: item.staffId,
      basePrice: service?.basePrice ?? 0,
      baseDurationMin: service?.clientDurationMin ?? 0,
    })
    itemPrices.push(resolved.price)
    itemDurations.push(resolved.durationMin)
    depositRequired += depositAmount(resolved.price, service?.deposit ?? null)
  }

  return {
    ctx,
    slot,
    itemPrices,
    itemDurations,
    totalPrice: itemPrices.reduce((sum, price) => sum + price, 0),
    depositRequired,
  }
}

// ─── criação ────────────────────────────────────────────────────────────────

export async function createAppointment(
  input: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  const plan = await planBooking(input)
  if (typeof plan === 'string') return fail(plan)

  try {
    const appointmentId = await db.transaction((tx) => writeAppointment(tx, input, plan))
    return {
      ok: true,
      appointmentId,
      slot: describeSlot(plan.ctx, plan.slot),
      depositRequired: plan.depositRequired,
    }
  } catch (error) {
    if (isExclusionViolation(error)) return fail('slot_taken')
    throw error
  }
}

async function writeAppointment(
  tx: Tx,
  input: CreateAppointmentInput,
  plan: Plan,
  rescheduledFromId?: string,
): Promise<string> {
  const [row] = await tx
    .insert(appointments)
    .values({
      unitId: plan.ctx.unit.id,
      clientId: input.clientId,
      startsAt: plan.slot.start,
      endsAt: plan.slot.end,
      status: 'scheduled',
      source: input.source,
      totalPrice: plan.totalPrice,
      depositRequired: plan.depositRequired,
      ...(input.clientNote ? { clientNote: input.clientNote } : {}),
      ...(input.internalNote ? { internalNote: input.internalNote } : {}),
      ...(input.actorId ? { createdBy: input.actorId } : {}),
      ...(rescheduledFromId ? { rescheduledFromId } : {}),
    })
    .returning({ id: appointments.id })

  const appointmentId = row!.id

  for (const [index, item] of plan.slot.items.entries()) {
    const service = plan.ctx.services.get(item.serviceId)
    const [itemRow] = await tx
      .insert(appointmentItems)
      .values({
        appointmentId,
        serviceId: item.serviceId,
        staffId: item.staffId,
        startsAt: item.start,
        endsAt: item.end,
        price: plan.itemPrices[index]!,
        durationMin: plan.itemDurations[index]!,
        durationProfile: {
          setupMin: service?.spec.duration.setupMin ?? 0,
          processingMin: service?.spec.duration.processingMin ?? 0,
          finishMin: service?.spec.duration.finishMin ?? 0,
        },
        sortOrder: index,
      })
      .returning({ id: appointmentItems.id })

    const itemId = itemRow!.id

    // dois blocos quando há processamento — o buraco entre eles fica livre
    await tx.insert(appointmentStaffBlocks).values(
      item.staffBusy.map((range) => ({
        appointmentItemId: itemId,
        staffId: item.staffId,
        block: toRange(range.start, range.end),
      })),
    )

    if (item.resourceIds.length > 0) {
      await tx.insert(appointmentResourceBlocks).values(
        item.resourceIds.map((resourceId) => ({
          appointmentItemId: itemId,
          resourceId,
          block: toRange(item.resourceBusy.start, item.resourceBusy.end),
        })),
      )
    }
  }

  await tx.insert(appointmentStatusEvents).values({
    appointmentId,
    toStatus: 'scheduled',
    ...(input.actorId ? { actorId: input.actorId } : {}),
  })

  return appointmentId
}

/**
 * 23P01 = `exclusion_violation`. É a constraint de anti-overbooking falando;
 * qualquer outro erro é bug e deve subir.
 */
function isExclusionViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23P01'
}

// ─── mudanças de status ─────────────────────────────────────────────────────

export type LiveStatus = 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed'
export type CancelStatus = 'cancelled_by_client' | 'cancelled_by_studio' | 'no_show'

const TIMESTAMP_FIELD: Partial<Record<LiveStatus, 'checkedInAt' | 'startedAt' | 'completedAt'>> = {
  checked_in: 'checkedInAt',
  in_progress: 'startedAt',
  completed: 'completedAt',
}

/**
 * Cancelar é ponto final. Depois dele não há para onde avançar.
 *
 * Cancelar APAGA os blocos de horário — é assim que o horário volta para a
 * agenda. Uma marcação cancelada que voltasse a `confirmed` ou `completed`
 * ressuscitava sem bloco nenhum: passava a desenhar-se por cima da cliente que
 * entretanto ficou com aquela hora, e como `ItemBlock` ocupa a coluna inteira,
 * quem desaparecia da vista era a cliente verdadeira. A recepção via um cartão
 * de alguém que não vem e não via quem vem.
 *
 * A janela é curta — o painel de uma marcação já aberta noutro separador, antes
 * do refresco de 45 s — mas o estrago é ver o dia errado. A ação irmã do lado
 * da cliente (`conta/actions.ts`) já fazia esta guarda; esta porta nunca a
 * recebeu.
 */
const ESTADOS_TERMINAIS = new Set<string>([
  'cancelled_by_client',
  'cancelled_by_studio',
  'no_show',
])

/** A frase da recusa, exportada porque quem chama precisa de a reconhecer. */
export const JA_CANCELADA = 'esta marcação foi cancelada — para a retomar, marque de novo'

export async function advanceStatus(
  appointmentId: string,
  to: LiveStatus,
  actorId?: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: appointments.status, clientId: appointments.clientId })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1)
    if (!current) throw new Error(`Agendamento ${appointmentId} não existe`)
    if (current.status === to) return
    if (ESTADOS_TERMINAIS.has(current.status)) throw new Error(JA_CANCELADA)

    const stamp = TIMESTAMP_FIELD[to]
    await tx
      .update(appointments)
      .set({ status: to, ...(stamp ? { [stamp]: new Date() } : {}) })
      .where(eq(appointments.id, appointmentId))

    await tx.insert(appointmentStatusEvents).values({
      appointmentId,
      fromStatus: current.status,
      toStatus: to,
      ...(actorId ? { actorId } : {}),
    })

    if (to === 'completed') {
      // a primeira visita só é gravada uma vez; a última, sempre
      await tx
        .update(clientProfiles)
        .set({
          lastVisitAt: new Date(),
          firstVisitAt: sql`coalesce(${clientProfiles.firstVisitAt}, now())`,
        })
        .where(eq(clientProfiles.id, current.clientId))
    }
  })
}

/**
 * Cancelar APAGA as linhas de bloqueio. É o que devolve o horário para a
 * agenda: bloco existente = horário ocupado, sem exceção de status.
 */
export async function cancelAppointment(
  appointmentId: string,
  to: CancelStatus,
  options: { reason?: string; actorId?: string } = {},
): Promise<void> {
  await db.transaction((tx) => releaseAppointment(tx, appointmentId, to, options))
}

async function releaseAppointment(
  tx: Tx,
  appointmentId: string,
  to: CancelStatus,
  options: { reason?: string; actorId?: string },
): Promise<void> {
  const [current] = await tx
    .select({ status: appointments.status, clientId: appointments.clientId })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1)
  if (!current) throw new Error(`Agendamento ${appointmentId} não existe`)

  /*
    Cancelar o que já está cancelado não é inofensivo por causa da linha de
    baixo: `no_show` soma uma falta à ficha da cliente. Dois toques em "Não
    veio" — e o botão não se desliga enquanto o servidor responde — davam duas
    faltas a quem faltou uma vez. A ficha dela passa a dizer que é reincidente,
    e é por esse número que o salão decide pedir sinal.
  */
  if (ESTADOS_TERMINAIS.has(current.status)) return

  const items = await tx
    .select({ id: appointmentItems.id })
    .from(appointmentItems)
    .where(eq(appointmentItems.appointmentId, appointmentId))
  const itemIds = items.map((item) => item.id)

  if (itemIds.length > 0) {
    await tx
      .delete(appointmentStaffBlocks)
      .where(inArray(appointmentStaffBlocks.appointmentItemId, itemIds))
    await tx
      .delete(appointmentResourceBlocks)
      .where(inArray(appointmentResourceBlocks.appointmentItemId, itemIds))
  }

  await tx
    .update(appointments)
    .set({
      status: to,
      cancelledAt: new Date(),
      ...(options.reason ? { cancellationReason: options.reason } : {}),
      ...(options.actorId ? { cancelledBy: options.actorId } : {}),
    })
    .where(eq(appointments.id, appointmentId))

  await tx.insert(appointmentStatusEvents).values({
    appointmentId,
    fromStatus: current.status,
    toStatus: to,
    ...(options.reason ? { reason: options.reason } : {}),
    ...(options.actorId ? { actorId: options.actorId } : {}),
  })

  if (to === 'no_show') {
    await tx
      .update(clientProfiles)
      .set({ noShowCount: sql`${clientProfiles.noShowCount} + 1` })
      .where(eq(clientProfiles.id, current.clientId))
  }
}

/**
 * Remarcação. O planejamento ignora a ocupação do agendamento original — senão
 * ele bloquearia a si mesmo ao mudar de 14h para 14h30. Liberar o horário antigo
 * e reservar o novo acontecem na MESMA transação: nunca existe um instante em
 * que a cliente ficou sem horário nenhum.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  input: CreateAppointmentInput,
): Promise<CreateAppointmentResult> {
  const plan = await planBooking(input, appointmentId)
  if (typeof plan === 'string') return fail(plan)

  try {
    const newId = await db.transaction(async (tx) => {
      await releaseAppointment(tx, appointmentId, 'cancelled_by_studio', {
        reason: 'Remarcado',
        ...(input.actorId ? { actorId: input.actorId } : {}),
      })
      return writeAppointment(tx, input, plan, appointmentId)
    })

    return {
      ok: true,
      appointmentId: newId,
      slot: describeSlot(plan.ctx, plan.slot),
      depositRequired: plan.depositRequired,
    }
  } catch (error) {
    if (isExclusionViolation(error)) return fail('slot_taken')
    throw error
  }
}
