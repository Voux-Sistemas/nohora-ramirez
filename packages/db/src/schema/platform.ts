import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { pk, tz } from './_shared'
import { users } from './people'

/**
 * Trilha de auditoria. Toda alteração de agenda, preço, comanda, comissão e
 * estoque grava `before`/`after`. É o que permite responder "quem mudou esse
 * horário?" sem depender da memória de ninguém.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: pk(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    occurredAt: tz('occurred_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorId, t.occurredAt),
  ],
)

/**
 * Consentimento LGPD, versionado. Anamnese e foto antes/depois são dado
 * pessoal sensível — sem consentimento registrado, não se usa.
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose')
      .$type<'image_use' | 'marketing' | 'data_processing' | 'health_data'>()
      .notNull(),
    granted: text('granted').$type<'yes' | 'no'>().notNull(),
    textVersion: text('text_version').notNull(),
    grantedAt: tz('granted_at'),
    revokedAt: tz('revoked_at'),
    ip: text('ip'),
  },
  (t) => [index('consent_records_user_purpose_idx').on(t.userId, t.purpose)],
)
