import 'server-only'

/**
 * Fechamento de comanda: confere o total, aplica desconto opcional, registra
 * o(s) pagamento(s) e gera a comissão de cada item. Uma vez fechada, a
 * comanda trava — reabrir não existe neste corte, é feito um novo lançamento
 * de ajuste se precisar corrigir.
 */

import {
  appointmentDiscounts,
  appointmentItems,
  appointments,
  cashMovements,
  cashSessions,
  clientProfiles,
  comandaClosures,
  commissionEntries,
  commissionRules,
  organizations,
  payments,
  services,
  staffProfiles,
  users,
} from '@studio/db'
import { ratearDesconto, resolveCommission } from '@studio/core'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pais } from '@/lib/pais'

export type PaymentMethod = 'cash' | 'debit_card' | 'credit_card' | 'pix' | 'other'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  pix: 'Pix',
  other: 'Outro',
}

/**
 * As formas que o balcão oferece hoje — que não são as mesmas em todo o lado.
 *
 * O enum do banco continua a guardar todas, e é por isso que o mapa de cima
 * cobre o conjunto inteiro: uma comanda fechada com Pix continua a ler-se
 * "Pix" para sempre. O que muda aqui é só o que a receção pode escolher.
 *
 * O Pix é serviço do Banco Central do Brasil e não existe em Portugal. Estava
 * na lista — e, pior, vinha pré-selecionado na primeira linha: quem fechasse a
 * comanda sem abrir o seletor registava, todos os dias, um meio de pagamento
 * que não aconteceu, e o fecho do caixa deixava de bater com a gaveta.
 */
export function metodosDoPais(): readonly PaymentMethod[] {
  const todos: PaymentMethod[] = ['cash', 'debit_card', 'credit_card', 'pix', 'other']
  return pais().codigo === 'BR' ? todos : todos.filter((m) => m !== 'pix')
}

export interface ComandaItemView {
  id: string
  serviceId: string
  serviceName: string
  staffId: string
  staffName: string
  price: number
}

export interface ComandaPaymentView {
  id: string
  method: PaymentMethod
  amount: number
  paidAt: Date
}

export interface ComandaView {
  appointmentId: string
  unitId: string
  status: string
  clientName: string
  items: ComandaItemView[]
  subtotal: number
  discount: number
  discountReason: string | null
  /**
   * O líquido: o que a cliente paga depois do desconto.
   *
   * Devolvia o bruto, e o recibo de uma comanda fechada contradizia-se — dizia
   * Subtotal 60,00 €, Desconto −10,00 € e Total 60,00 €, com 50,00 € pagos por
   * baixo. Quem lê um recibo assim não sabe se cobrou a menos.
   */
  total: number
  /**
   * O bruto, que é a base de que o fecho subtrai o desconto.
   *
   * Fica separado porque o formulário de fecho precisa exactamente do mesmo
   * número que `closeComanda` usa em `expectedTotal` — se lhe passássemos o
   * líquido, o botão só acenderia com o desconto contado duas vezes.
   */
  grossTotal: number
  payments: ComandaPaymentView[]
  paidTotal: number
  closed: boolean
}

export async function getComanda(appointmentId: string): Promise<ComandaView | null> {
  const [row] = await db
    .select({
      id: appointments.id,
      unitId: appointments.unitId,
      status: appointments.status,
      totalPrice: appointments.totalPrice,
      clientName: users.name,
    })
    .from(appointments)
    .innerJoin(clientProfiles, eq(clientProfiles.id, appointments.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(appointments.id, appointmentId))
    .limit(1)
  if (!row) return null

  const [items, discountRow, paymentRows, closure] = await Promise.all([
    db
      .select({
        id: appointmentItems.id,
        serviceId: appointmentItems.serviceId,
        serviceName: services.name,
        staffId: appointmentItems.staffId,
        staffName: staffProfiles.displayName,
        price: appointmentItems.price,
      })
      .from(appointmentItems)
      .innerJoin(staffProfiles, eq(staffProfiles.id, appointmentItems.staffId))
      .innerJoin(services, eq(services.id, appointmentItems.serviceId))
      .where(eq(appointmentItems.appointmentId, appointmentId)),
    db
      .select({ amount: appointmentDiscounts.amount, reason: appointmentDiscounts.reason })
      .from(appointmentDiscounts)
      .where(eq(appointmentDiscounts.appointmentId, appointmentId))
      .limit(1),
    db
      .select({
        id: payments.id,
        method: payments.method,
        amount: payments.amount,
        paidAt: payments.paidAt,
      })
      .from(payments)
      .where(eq(payments.appointmentId, appointmentId)),
    db
      .select({ id: comandaClosures.id })
      .from(comandaClosures)
      .where(eq(comandaClosures.appointmentId, appointmentId))
      .limit(1),
  ])

  const subtotal = items.reduce((sum, i) => sum + i.price, 0)
  const discount = discountRow[0]?.amount ?? 0
  const paidTotal = paymentRows.reduce((sum, p) => sum + p.amount, 0)

  return {
    appointmentId: row.id,
    unitId: row.unitId,
    status: row.status,
    clientName: row.clientName,
    items,
    subtotal,
    discount,
    discountReason: discountRow[0]?.reason ?? null,
    total: row.totalPrice - discount,
    grossTotal: row.totalPrice,
    payments: paymentRows,
    paidTotal,
    closed: closure.length > 0,
  }
}

export interface ClosePaymentInput {
  method: PaymentMethod
  amount: number
}

export interface CloseComandaInput {
  discountAmount: number
  discountReason?: string
  payments: ClosePaymentInput[]
}

export async function closeComanda(appointmentId: string, input: CloseComandaInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [appointment] = await tx
      .select({
        id: appointments.id,
        unitId: appointments.unitId,
        status: appointments.status,
        totalPrice: appointments.totalPrice,
      })
      .from(appointments)
      .where(eq(appointments.id, appointmentId))
      .limit(1)
    if (!appointment) throw new Error('agendamento não encontrado')
    if (appointment.status !== 'completed') {
      throw new Error('só é possível fechar comanda de um atendimento concluído')
    }

    const [alreadyClosed] = await tx
      .select({ id: comandaClosures.id })
      .from(comandaClosures)
      .where(eq(comandaClosures.appointmentId, appointmentId))
      .limit(1)
    if (alreadyClosed) throw new Error('comanda já fechada')

    /* Antes de comparar somas: desconto maior do que a comanda dava
       "soma dos pagamentos não bate com o total", e ao balcão isso mandava
       conferir os pagamentos — que estavam certos. O erro estava no desconto. */
    if (input.discountAmount > appointment.totalPrice) {
      throw new Error('o desconto é maior do que o total da comanda')
    }

    const expectedTotal = appointment.totalPrice - input.discountAmount
    const paidTotal = input.payments.reduce((sum, p) => sum + p.amount, 0)
    if (paidTotal !== expectedTotal) {
      throw new Error('soma dos pagamentos não bate com o total após desconto')
    }

    if (input.discountAmount > 0) {
      await tx.insert(appointmentDiscounts).values({
        appointmentId,
        amount: input.discountAmount,
        reason: input.discountReason || null,
      })
    }

    let cashSessionId: string | null = null
    const hasCash = input.payments.some((p) => p.method === 'cash')
    if (hasCash) {
      const [session] = await tx
        .select({ id: cashSessions.id })
        .from(cashSessions)
        .where(and(eq(cashSessions.unitId, appointment.unitId), eq(cashSessions.status, 'open')))
        .limit(1)
      if (!session) throw new Error('não há caixa aberto nesta unidade para receber em dinheiro')
      cashSessionId = session.id
    }

    for (const payment of input.payments) {
      if (payment.amount <= 0) continue
      await tx.insert(payments).values({
        appointmentId,
        cashSessionId: payment.method === 'cash' ? cashSessionId : null,
        method: payment.method,
        amount: payment.amount,
      })
      if (payment.method === 'cash' && cashSessionId) {
        await tx.insert(cashMovements).values({
          cashSessionId,
          type: 'payment',
          amount: payment.amount,
          note: `comanda ${appointmentId}`,
        })
      }
    }

    await tx.insert(comandaClosures).values({ appointmentId })

    const items = await tx
      .select({
        id: appointmentItems.id,
        serviceId: appointmentItems.serviceId,
        staffId: appointmentItems.staffId,
        price: appointmentItems.price,
      })
      .from(appointmentItems)
      .where(eq(appointmentItems.appointmentId, appointmentId))

    const [org] = await tx.select({ id: organizations.id }).from(organizations).limit(1)
    const rules = org
      ? await tx
          .select({
            staffId: commissionRules.staffId,
            serviceId: commissionRules.serviceId,
            percentBps: commissionRules.percentBps,
          })
          .from(commissionRules)
          .where(eq(commissionRules.organizationId, org.id))
      : []

    /* O desconto é lançado sobre a visita inteira, mas a comissão é por item —
       cada linha tem a sua profissional. `ratearDesconto` reparte-o na proporção
       do preço sem perder cêntimos pelo caminho; a conta e o porquê estão lá. */
    const partes = ratearDesconto(
      items.map((i) => i.price),
      input.discountAmount,
    )
    for (const [indice, item] of items.entries()) {
      const baseAmount = Math.max(0, item.price - partes[indice]!)
      const resolved = resolveCommission(rules, item.staffId, item.serviceId, baseAmount)
      await tx.insert(commissionEntries).values({
        appointmentItemId: item.id,
        staffId: item.staffId,
        serviceId: item.serviceId,
        baseAmount,
        percentBps: resolved.percentBps,
        amount: resolved.amount,
      })
    }
  })
}

