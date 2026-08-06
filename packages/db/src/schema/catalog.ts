import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { pk, timestamps } from './_shared'
import { organizations, resourceTypes, units } from './organization'
import { staffProfiles } from './people'

export const serviceCategories = pgTable(
  'service_categories',
  {
    id: pk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex('service_categories_org_name_uq').on(t.organizationId, t.name)],
)

/**
 * Catálogo da rede. O preço aqui é o de referência; unidade e profissional
 * podem ter exceção em `service_pricing`.
 *
 * A duração é composta — ver `docs/ARQUITETURA.md`:
 *   setup (aplicação) → processing (profissional livre) → finish (finalização)
 * Todo valor monetário é INTEIRO EM CENTAVOS.
 */
export const services = pgTable(
  'services',
  {
    id: pk(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => serviceCategories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),

    basePrice: integer('base_price').notNull(),
    setupMin: integer('setup_min').notNull(),
    processingMin: integer('processing_min').notNull().default(0),
    finishMin: integer('finish_min').notNull().default(0),
    bufferBeforeMin: integer('buffer_before_min').notNull().default(0),
    bufferAfterMin: integer('buffer_after_min').notNull().default(0),

    onlineBookable: boolean('online_bookable').notNull().default(true),
    requiresDeposit: boolean('requires_deposit').notNull().default(false),
    /** 'percent' guarda pontos-base (5000 = 50%); 'fixed' guarda centavos. */
    depositType: text('deposit_type').$type<'percent' | 'fixed'>(),
    depositValue: integer('deposit_value'),
    /** Alguns procedimentos só podem ser marcados após avaliação presencial. */
    requiresAssessment: boolean('requires_assessment').notNull().default(false),
    requiresAnamnesis: boolean('requires_anamnesis').notNull().default(false),

    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index('services_org_active_idx').on(t.organizationId, t.active),
    index('services_category_idx').on(t.categoryId),
  ],
)

/**
 * Exceção de preço/duração.
 * Precedência: staff+unit → staff → unit → base. Ver `resolvePrice` em @studio/core.
 */
export const servicePricing = pgTable(
  'service_pricing',
  {
    id: pk(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staffProfiles.id, { onDelete: 'cascade' }),
    price: integer('price').notNull(),
    /** Sobrescreve a duração TOTAL. Nulo = mantém a do catálogo. */
    durationOverrideMin: integer('duration_override_min'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('service_pricing_uq').on(t.serviceId, t.unitId, t.staffId),
    index('service_pricing_service_idx').on(t.serviceId),
  ],
)

/** Matriz de habilidades: quem pode executar o quê. */
export const staffSkills = pgTable(
  'staff_skills',
  {
    id: pk(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(true),
    ...timestamps(),
  },
  (t) => [uniqueIndex('staff_skills_uq').on(t.staffId, t.serviceId)],
)

/** Quais recursos o serviço consome (cabine, lavatório, equipamento). */
export const serviceResourceRequirements = pgTable(
  'service_resource_requirements',
  {
    id: pk(),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    resourceTypeId: uuid('resource_type_id')
      .notNull()
      .references(() => resourceTypes.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    ...timestamps(),
  },
  (t) => [uniqueIndex('service_resource_requirements_uq').on(t.serviceId, t.resourceTypeId)],
)
