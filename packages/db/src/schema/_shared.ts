import { pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core'

/** Chave primária padrão do projeto. */
export const pk = () => uuid('id').primaryKey().defaultRandom()

/** Timestamp com fuso — TODA data do sistema é `timestamptz`, armazenada em UTC. */
export const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const createdAt = () => tz('created_at').notNull().defaultNow()
export const updatedAt = () =>
  tz('updated_at')
    .notNull()
    .defaultNow()
    // `Date`, não `sql\`now()\``: o valor do $onUpdate passa pelo mapToDriverValue
    // da coluna, que só aceita Date. Com SQL aqui todo UPDATE quebra.
    .$onUpdate(() => new Date())
export const deletedAt = () => tz('deleted_at')

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// ─── enums ──────────────────────────────────────────────────────────────────

export const userStatusEnum = pgEnum('user_status', ['active', 'invited', 'suspended'])

export const roleEnum = pgEnum('role', [
  'client',
  'professional',
  'receptionist',
  'unit_manager',
  'finance',
  'owner',
])

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'draft',
  'scheduled',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'cancelled_by_client',
  'cancelled_by_studio',
  'no_show',
])

/** Status em que o horário ainda está reservado de fato. */
export const LIVE_APPOINTMENT_STATUSES = [
  'draft',
  'scheduled',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
] as const

export const appointmentSourceEnum = pgEnum('appointment_source', [
  'client_app',
  'reception',
  'whatsapp',
  'phone',
  'walk_in',
  'recurrence',
])

export const timeOffTypeEnum = pgEnum('time_off_type', [
  'day_off',
  'vacation',
  'lunch',
  'training',
  'sick_leave',
  'block',
])

export const notificationChannelEnum = pgEnum('notification_channel', [
  'whatsapp',
  'email',
  'push',
  'sms',
])

export const notificationStatusEnum = pgEnum('notification_status', [
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
])

export const templateCategoryEnum = pgEnum('template_category', [
  'utility',
  'marketing',
  'authentication',
])
