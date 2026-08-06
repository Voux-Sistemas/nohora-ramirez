import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  appointmentSourceEnum,
  appointmentStatusEnum,
  pk,
  timestamps,
  tz,
} from './_shared'
import { resources, units } from './organization'
import { clientProfiles, staffProfiles, users } from './people'
import { services } from './catalog'

/**
 * `tstzrange` do Postgres. É o que viabiliza a constraint de exclusão que
 * impede overbooking no nível do banco — a única garantia real contra corrida.
 */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType: () => 'tstzrange',
})

/** Monta o literal de intervalo semiaberto `[início, fim)`. */
export function toRange(start: Date, end: Date): string {
  return `[${start.toISOString()},${end.toISOString()})`
}

/**
 * A visita do cliente. Envelope de um ou mais serviços.
 * `startsAt`/`endsAt` cobrem do primeiro ao último item.
 */
export const appointments = pgTable(
  'appointments',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clientProfiles.id, { onDelete: 'restrict' }),
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at').notNull(),
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    source: appointmentSourceEnum('source').notNull().default('client_app'),

    /** Observação do cliente no ato do agendamento. */
    clientNote: text('client_note'),
    /** Observação interna da recepção. */
    internalNote: text('internal_note'),

    /** Total congelado no momento do agendamento, em centavos. */
    totalPrice: integer('total_price').notNull().default(0),
    depositRequired: integer('deposit_required').notNull().default(0),
    depositPaidAt: tz('deposit_paid_at'),

    checkedInAt: tz('checked_in_at'),
    startedAt: tz('started_at'),
    completedAt: tz('completed_at'),
    cancelledAt: tz('cancelled_at'),
    cancellationReason: text('cancellation_reason'),
    cancelledBy: uuid('cancelled_by').references(() => users.id, { onDelete: 'set null' }),

    /** Quando é remarcação, aponta para o agendamento original. */
    rescheduledFromId: uuid('rescheduled_from_id'),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    index('appointments_unit_start_idx').on(t.unitId, t.startsAt),
    index('appointments_client_start_idx').on(t.clientId, t.startsAt),
    index('appointments_status_start_idx').on(t.status, t.startsAt),
  ],
)

/**
 * Um item por serviço da visita.
 * `price` e `durationMin` ficam congelados aqui: mexer na tabela de preços
 * nunca pode reescrever o passado.
 */
export const appointmentItems = pgTable(
  'appointment_items',
  {
    id: pk(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'restrict' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'restrict' }),
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at').notNull(),
    price: integer('price').notNull(),
    durationMin: integer('duration_min').notNull(),
    /** Perfil de duração aplicado, congelado para auditoria. */
    durationProfile: jsonb('duration_profile')
      .$type<{ setupMin: number; processingMin: number; finishMin: number }>()
      .notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('appointment_items_appointment_idx').on(t.appointmentId),
    index('appointment_items_staff_start_idx').on(t.staffId, t.startsAt),
  ],
)

/**
 * Reserva efetiva do profissional. Um item de agendamento gera DOIS blocos
 * quando o serviço tem processamento — e é justamente o intervalo entre eles
 * que fica livre para encaixar outro cliente (gap booking).
 *
 * A constraint de exclusão vive nesta tabela (ver migração SQL).
 * Cancelar um agendamento APAGA estas linhas: bloco existente = horário ocupado.
 */
export const appointmentStaffBlocks = pgTable(
  'appointment_staff_blocks',
  {
    id: pk(),
    appointmentItemId: uuid('appointment_item_id')
      .notNull()
      .references(() => appointmentItems.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'cascade' }),
    /** Inclui os buffers — é essa a função deles. */
    block: tstzrange('block').notNull(),
    ...timestamps(),
  },
  (t) => [index('appointment_staff_blocks_staff_idx').on(t.staffId)],
)

/** Reserva do recurso físico. Cobre o serviço inteiro, processamento incluído. */
export const appointmentResourceBlocks = pgTable(
  'appointment_resource_blocks',
  {
    id: pk(),
    appointmentItemId: uuid('appointment_item_id')
      .notNull()
      .references(() => appointmentItems.id, { onDelete: 'cascade' }),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    block: tstzrange('block').notNull(),
    ...timestamps(),
  },
  (t) => [index('appointment_resource_blocks_resource_idx').on(t.resourceId)],
)

/** Trilha de mudança de status — quem mexeu, quando e por quê. */
export const appointmentStatusEvents = pgTable(
  'appointment_status_events',
  {
    id: pk(),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    fromStatus: appointmentStatusEnum('from_status'),
    toStatus: appointmentStatusEnum('to_status').notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    reason: text('reason'),
    occurredAt: tz('occurred_at').notNull().defaultNow(),
  },
  (t) => [index('appointment_status_events_appointment_idx').on(t.appointmentId)],
)

/** Fila para horário lotado. Ao abrir vaga, o worker oferece por ordem. */
export const waitlistEntries = pgTable(
  'waitlist_entries',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clientProfiles.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staffProfiles.id, { onDelete: 'set null' }),
    desiredFrom: tz('desired_from').notNull(),
    desiredTo: tz('desired_to').notNull(),
    status: text('status').$type<'waiting' | 'offered' | 'booked' | 'expired' | 'cancelled'>()
      .notNull()
      .default('waiting'),
    offeredAt: tz('offered_at'),
    offerExpiresAt: tz('offer_expires_at'),
    ...timestamps(),
  },
  (t) => [index('waitlist_unit_status_idx').on(t.unitId, t.status, t.desiredFrom)],
)
