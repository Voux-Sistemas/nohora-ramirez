import { index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { pk, timestamps, tz } from './_shared'
import { appointmentItems, appointments } from './scheduling'
import { organizations, units } from './organization'
import { services } from './catalog'
import { staffProfiles, users } from './people'

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

export const commissionStatusEnum = pgEnum('commission_status', ['pending', 'paid'])

/**
 * Percentual de comissão. Precedência, do mais específico ao mais genérico:
 *   profissional + serviço  →  profissional  →  serviço  →  padrão da rede
 * Mesmo desenho de `service_pricing` — ver `resolveCommission` em @studio/core.
 */
export const commissionRules = pgTable(
  'commission_rules',
  {
    id: pk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staffProfiles.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id').references(() => services.id, { onDelete: 'cascade' }),
    /** Pontos-base: 3000 = 30%. */
    percentBps: integer('percent_bps').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('commission_rules_scope_uq').on(t.organizationId, t.staffId, t.serviceId),
    index('commission_rules_org_idx').on(t.organizationId),
  ],
)

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

/**
 * Comissão gerada por item de serviço ao fechar a comanda. `baseAmount` é o
 * preço efetivamente cobrado (após desconto rateado); congelado junto com o
 * percentual — mudar a regra depois nunca reescreve comissão já gerada.
 */
export const commissionEntries = pgTable(
  'commission_entries',
  {
    id: pk(),
    appointmentItemId: uuid('appointment_item_id')
      .notNull()
      .unique()
      .references(() => appointmentItems.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'restrict' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    baseAmount: integer('base_amount').notNull(),
    percentBps: integer('percent_bps').notNull(),
    amount: integer('amount').notNull(),
    status: commissionStatusEnum('status').notNull().default('pending'),
    paidAt: tz('paid_at'),
    ...timestamps(),
  },
  (t) => [
    index('commission_entries_staff_status_idx').on(t.staffId, t.status),
    index('commission_entries_staff_created_idx').on(t.staffId, t.createdAt),
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

/** Comanda fechada: trava novos pagamentos/descontos, dispara a comissão. */
export const comandaClosures = pgTable('comanda_closures', {
  id: pk(),
  appointmentId: uuid('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id, { onDelete: 'cascade' }),
  closedBy: uuid('closed_by').references(() => users.id, { onDelete: 'set null' }),
  closedAt: tz('closed_at').notNull().defaultNow(),
})
