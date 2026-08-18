import { index, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps, tz } from './_shared'
import { appointments } from './scheduling'
import { units } from './organization'
import { users } from './people'

export const paymentMethodEnum = pgEnum('payment_method', [
  'cash',
  'debit_card',
  'credit_card',
  'pix',
  'other',
])

export const cashSessionStatusEnum = pgEnum('cash_session_status', ['open', 'closed'])

export const cashMovementTypeEnum = pgEnum('cash_movement_type', [
  'payment',
  'reinforcement',
  'withdrawal',
])

/**
 * Sessão de caixa: abertura e fechamento por unidade. Todo pagamento em
 * dinheiro precisa de uma sessão aberta — é o que permite conferir a gaveta
 * no fim do turno.
 */
export const cashSessions = pgTable(
  'cash_sessions',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    status: cashSessionStatusEnum('status').notNull().default('open'),
    openingAmount: integer('opening_amount').notNull().default(0),
    /** Contado fisicamente no fechamento. Nulo enquanto aberto. */
    closingCountedAmount: integer('closing_counted_amount'),
    /** Abertura + pagamentos em dinheiro + reforços − sangrias. */
    expectedAmount: integer('expected_amount'),
    /** Contado − esperado. Positivo = sobra, negativo = falta. */
    difference: integer('difference'),
    openedBy: uuid('opened_by').references(() => users.id, { onDelete: 'set null' }),
    closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
    openedAt: tz('opened_at').notNull().defaultNow(),
    closedAt: tz('closed_at'),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [index('cash_sessions_unit_status_idx').on(t.unitId, t.status)],
)

/**
 * Toda movimentação do caixa: pagamento recebido, reforço de troco, sangria.
 * `payment` é gerado automaticamente ao fechar uma comanda em dinheiro;
 * `reinforcement`/`withdrawal` são lançamentos avulsos da recepção.
 */
export const cashMovements = pgTable(
  'cash_movements',
  {
    id: pk(),
    cashSessionId: uuid('cash_session_id')
      .notNull()
      .references(() => cashSessions.id, { onDelete: 'cascade' }),
    type: cashMovementTypeEnum('type').notNull(),
    amount: integer('amount').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    occurredAt: tz('occurred_at').notNull().defaultNow(),
  },
  (t) => [index('cash_movements_session_idx').on(t.cashSessionId)],
)

/**
 * Pagamento da comanda. Uma visita pode ser paga em mais de uma forma
 * (parte no cartão, parte no pix) — por isso é uma linha por método, não
 * um campo único em `appointments`.
 */
export const payments = pgTable(
  'payments',
  {
    id: pk(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'restrict' }),
    cashSessionId: uuid('cash_session_id').references(() => cashSessions.id, {
      onDelete: 'set null',
    }),
    method: paymentMethodEnum('method').notNull(),
    amount: integer('amount').notNull(),
    receivedBy: uuid('received_by').references(() => users.id, { onDelete: 'set null' }),
    paidAt: tz('paid_at').notNull().defaultNow(),
  },
  (t) => [
    index('payments_appointment_idx').on(t.appointmentId),
    index('payments_session_idx').on(t.cashSessionId),
  ],
)

/** Desconto aplicado no fechamento da comanda — não mexe no preço congelado do item. */
export const appointmentDiscounts = pgTable('appointment_discounts', {
  id: pk(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  reason: text('reason'),
  appliedBy: uuid('applied_by').references(() => users.id, { onDelete: 'set null' }),
  ...timestamps(),
})

/** Comanda fechada: trava novos pagamentos e descontos. */
export const comandaClosures = pgTable('comanda_closures', {
  id: pk(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  closedAt: tz('closed_at').notNull().defaultNow(),
})
