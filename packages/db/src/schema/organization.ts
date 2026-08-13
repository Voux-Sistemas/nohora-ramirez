import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { pk, timestamps, tz } from './_shared'

/** A rede. Uma linha por enquanto — mas o sistema já nasce pronto para mais. */
export const organizations = pgTable('organizations', {
  id: pk(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  document: text('document'),
  /*
     Fallback de banco, não decisão de produto: quem manda no fuso é a unidade,
     e o formulário de cadastro sempre envia um. Isto só cobre linha inserida
     por SQL direto. Está em Lisboa porque é onde a rede em produção opera.
  */
  timezone: text('timezone').notNull().default('Europe/Lisbon'),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  ...timestamps(),
})

/**
 * `settings` da unidade guarda as regras de agendamento:
 *   { minLeadMin, maxLeadDays, granularityMin, cancellationWindowHours,
 *     interServiceGapMin, depositPolicy, noShowPolicy }
 */
export const units = pgTable(
  'units',
  {
    id: pk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    phone: text('phone'),
    email: text('email'),
    addressLine: text('address_line'),
    district: text('district'),
    city: text('city'),
    state: text('state'),
    postalCode: text('postal_code'),
    latitude: text('latitude'),
    longitude: text('longitude'),
    /**
     * Foto da loja. A cliente escolhe onde ser atendida olhando o lugar, não
     * lendo o endereço — a imagem é o conteúdo da decisão, não enfeite. Mesmo
     * padrão de `services.image_url` e `staff_profiles.avatar_url`: URL em
     * coluna de texto, o storage fica atrás da URL.
     */
    imageUrl: text('image_url'),
    timezone: text('timezone').notNull().default('Europe/Lisbon'),
    active: boolean('active').notNull().default(true),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps(),
  },
  (t) => [uniqueIndex('units_org_slug_uq').on(t.organizationId, t.slug)],
)

/**
 * As fotografias da sala.
 *
 * `units.image_url` continua sendo a capa — a foto única que representa a loja
 * na vitrine e na pauta do dia. Esta tabela é o resto do ensaio: o que a página
 * da loja mostra para quem quer ver onde vai passar duas horas.
 *
 * Tabela em vez de array em `settings` por um motivo prático: o formulário de
 * unidade reescreve `settings` inteiro a cada gravação, e uma galeria guardada
 * lá seria apagada em silêncio no dia em que alguém corrigisse o telefone.
 *
 * `sortOrder` existe porque a ordem é a composição. Uma loja com três fotos boas
 * e uma loja com seis contam a mesma história se a primeira for a certa.
 */
export const unitPhotos = pgTable(
  'unit_photos',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** Descrição para quem não vê a imagem. Vazio é aceito; mentira não. */
    alt: text('alt'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('unit_photos_unit_order_idx').on(t.unitId, t.sortOrder)],
)

/**
 * Horário de funcionamento. Mais de uma linha por dia da semana permite
 * representar o intervalo de almoço (ex.: 09:00–12:00 e 13:00–18:00).
 */
export const unitHours = pgTable(
  'unit_hours',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    /** 0 = domingo … 6 = sábado */
    weekday: smallint('weekday').notNull(),
    opensAt: time('opens_at').notNull(),
    closesAt: time('closes_at').notNull(),
    ...timestamps(),
  },
  (t) => [index('unit_hours_unit_weekday_idx').on(t.unitId, t.weekday)],
)

/** Feriados, eventos e horários especiais. Sobrepõem-se ao `unit_hours`. */
export const unitExceptions = pgTable(
  'unit_exceptions',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    closed: boolean('closed').notNull().default(true),
    opensAt: time('opens_at'),
    closesAt: time('closes_at'),
    reason: text('reason'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('unit_exceptions_unit_date_uq').on(t.unitId, t.date, t.opensAt)],
)

/**
 * Tipos de recurso físico: cabine, lavatório, secador, maca, equipamento.
 *
 * O tipo é da REDE, não da unidade — "cabine" é o mesmo conceito nas três lojas.
 * A instância é que pertence a uma unidade (ver `resources`). Se o tipo fosse
 * por unidade, o catálogo de serviços (que é da rede) precisaria de uma linha de
 * requisito por unidade só para dizer a mesma coisa três vezes.
 */
export const resourceTypes = pgTable(
  'resource_types',
  {
    id: pk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    ...timestamps(),
  },
  (t) => [uniqueIndex('resource_types_org_name_uq').on(t.organizationId, t.name)],
)

/** A instância física. Duas cabines = duas linhas. */
export const resources = pgTable(
  'resources',
  {
    id: pk(),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    resourceTypeId: uuid('resource_type_id')
      .notNull()
      .references(() => resourceTypes.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    /** Ordem de preferência ao alocar automaticamente. */
    priority: integer('priority').notNull().default(0),
    ...timestamps(),
  },
  (t) => [index('resources_unit_type_idx').on(t.unitId, t.resourceTypeId)],
)

/** Bloqueio de recurso: manutenção, reforma, equipamento quebrado. */
export const resourceBlocks = pgTable(
  'resource_blocks',
  {
    id: pk(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at').notNull(),
    reason: text('reason'),
    ...timestamps(),
  },
  (t) => [index('resource_blocks_resource_start_idx').on(t.resourceId, t.startsAt)],
)
