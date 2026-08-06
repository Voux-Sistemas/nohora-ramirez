import { boolean, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import {
  notificationChannelEnum,
  notificationStatusEnum,
  pk,
  templateCategoryEnum,
  timestamps,
  tz,
} from './_shared'
import { organizations } from './organization'
import { users } from './people'

/**
 * Templates de mensagem. Os do WhatsApp precisam ser aprovados pela Meta antes
 * de poderem ser enviados fora da janela de 24h — daí `approved` e
 * `providerTemplateId`.
 *
 * Categoria importa no custo: `utility` (lembrete, confirmação) é barato;
 * `marketing` (reativação, aniversário) é caro.
 */
export const messageTemplates = pgTable(
  'message_templates',
  {
    id: pk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    /** Chave usada no código, ex.: 'appointment_reminder_24h'. */
    key: text('key').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    category: templateCategoryEnum('category').notNull().default('utility'),
    language: text('language').notNull().default('pt_BR'),
    body: text('body').notNull(),
    variables: text('variables').array().notNull().default([]),
    providerTemplateId: text('provider_template_id'),
    approved: boolean('approved').notNull().default(false),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [index('message_templates_org_key_idx').on(t.organizationId, t.key, t.channel)],
)

/**
 * Registro de tudo que sai do sistema. Serve para auditoria, para não enviar
 * duas vezes e para medir custo de WhatsApp por mês.
 */
export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: pk(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    channel: notificationChannelEnum('channel').notNull(),
    templateKey: text('template_key'),
    /** A que entidade a mensagem se refere: 'appointment', 'waitlist'… */
    refType: text('ref_type'),
    refId: uuid('ref_id'),
    /** Destino resolvido (telefone ou e-mail) no momento do envio. */
    destination: text('destination'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    status: notificationStatusEnum('status').notNull().default('queued'),
    providerMessageId: text('provider_message_id'),
    providerResponse: jsonb('provider_response').$type<Record<string, unknown>>(),
    /** Custo em centavos, quando o provedor informa. */
    costCents: integer('cost_cents'),
    scheduledFor: tz('scheduled_for'),
    sentAt: tz('sent_at'),
    failedAt: tz('failed_at'),
    error: text('error'),
    ...timestamps(),
  },
  (t) => [
    index('notification_logs_ref_idx').on(t.refType, t.refId),
    index('notification_logs_status_idx').on(t.status, t.scheduledFor),
  ],
)
