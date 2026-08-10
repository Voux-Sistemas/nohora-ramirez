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
import { pk, roleEnum, timeOffTypeEnum, timestamps, tz, userStatusEnum } from './_shared'
import { units } from './organization'

/**
 * Uma única tabela de pessoas. Cliente e equipe compartilham `users`;
 * o que diferencia é o papel e o perfil associado.
 *
 * `phone` é o identificador principal — é por ele que o cliente entra (OTP)
 * e é ele que garante cliente único nas 3 unidades.
 */
export const users = pgTable(
  'users',
  {
    id: pk(),
    /** E.164, ex.: +5511999998888 */
    phone: text('phone').notNull().unique(),
    email: text('email'),
    name: text('name').notNull(),
    avatarUrl: text('avatar_url'),
    /** Só para a equipe. Cliente entra por OTP. */
    passwordHash: text('password_hash'),
    status: userStatusEnum('status').notNull().default('active'),
    lastLoginAt: tz('last_login_at'),
    deletedAt: tz('deleted_at'),
    ...timestamps(),
  },
  (t) => [index('users_email_idx').on(t.email), index('users_name_idx').on(t.name)],
)

/**
 * Papel atribuído por unidade. `unitId` nulo = papel de escopo rede
 * (é assim que a dona enxerga tudo).
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('user_roles_user_unit_role_uq').on(t.userId, t.unitId, t.role),
    index('user_roles_user_idx').on(t.userId),
  ],
)

/**
 * Códigos de uso único mandados por e-mail. Expiram e valem uma vez só.
 *
 * `purpose` separa dois pedidos que chegam pelo mesmo telefone e não podem se
 * misturar: `login` entra na área da cliente, `recovery` troca a senha da
 * equipe. Sem essa coluna, um código pedido para recuperar senha também abriria
 * uma sessão pela porta do login — a pessoa pediria uma coisa e receberia
 * outra, maior.
 */
export const authOtps = pgTable(
  'auth_otps',
  {
    id: pk(),
    phone: text('phone').notNull(),
    purpose: text('purpose').notNull().default('login'),
    codeHash: text('code_hash').notNull(),
    expiresAt: tz('expires_at').notNull(),
    consumedAt: tz('consumed_at'),
    attempts: integer('attempts').notNull().default(0),
    requestIp: text('request_ip'),
    ...timestamps(),
  },
  (t) => [index('auth_otps_phone_idx').on(t.phone, t.purpose, t.expiresAt)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: tz('expires_at').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    revokedAt: tz('revoked_at'),
    ...timestamps(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

// ─── equipe ─────────────────────────────────────────────────────────────────

export const staffProfiles = pgTable('staff_profiles', {
  id: pk(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  bio: text('bio'),
  /** Cor da coluna na agenda e do avatar que a cliente vê.
      O padrão é o tabaco da paleta da marca — o violeta que estava aqui vinha
      da paleta padrão do Tailwind e entrava em toda profissional nova. */
  color: text('color').notNull().default('#95663a'),
  /** Se pode ser escolhido pelo cliente no agendamento online. */
  acceptsOnlineBooking: boolean('accepts_online_booking').notNull().default(true),
  hiredAt: date('hired_at'),
  active: boolean('active').notNull().default(true),
  ...timestamps(),
})

/** Um profissional pode atender em mais de uma unidade. */
export const staffUnits = pgTable(
  'staff_units',
  {
    id: pk(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex('staff_units_uq').on(t.staffId, t.unitId)],
)

/**
 * Escala recorrente por dia da semana, com vigência.
 * Trocar a escala = fechar a vigência antiga e abrir uma nova, nunca editar
 * a linha existente — senão o passado da agenda muda junto.
 */
export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: pk(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(),
    startsAt: time('starts_at').notNull(),
    endsAt: time('ends_at').notNull(),
    validFrom: date('valid_from').notNull(),
    validTo: date('valid_to'),
    ...timestamps(),
  },
  (t) => [index('staff_schedules_staff_weekday_idx').on(t.staffId, t.weekday, t.validFrom)],
)

/** Folga, férias, almoço, curso, atestado — e bloqueio avulso. */
export const staffTimeOff = pgTable(
  'staff_time_off',
  {
    id: pk(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    type: timeOffTypeEnum('type').notNull(),
    startsAt: tz('starts_at').notNull(),
    endsAt: tz('ends_at').notNull(),
    note: text('note'),
    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps(),
  },
  (t) => [index('staff_time_off_staff_start_idx').on(t.staffId, t.startsAt)],
)

// ─── clientes ───────────────────────────────────────────────────────────────

export const clientProfiles = pgTable(
  'client_profiles',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    birthdate: date('birthdate'),
    document: text('document'),
    howFoundUs: text('how_found_us'),
    preferredUnitId: uuid('preferred_unit_id').references(() => units.id, {
      onDelete: 'set null',
    }),
    preferredStaffId: uuid('preferred_staff_id').references(() => staffProfiles.id, {
      onDelete: 'set null',
    }),
    tags: text('tags').array().notNull().default([]),
    /** Preferências livres: bebida, alergia, observação de atendimento. */
    preferences: jsonb('preferences').$type<Record<string, unknown>>().notNull().default({}),
    noShowCount: integer('no_show_count').notNull().default(0),
    /** Passa a exigir sinal quando o histórico de falta justifica. */
    requiresDeposit: boolean('requires_deposit').notNull().default(false),
    firstVisitAt: tz('first_visit_at'),
    lastVisitAt: tz('last_visit_at'),
    ...timestamps(),
  },
  (t) => [
    index('client_profiles_last_visit_idx').on(t.lastVisitAt),
    index('client_profiles_birthdate_idx').on(t.birthdate),
  ],
)

/** Observações internas — nunca visíveis ao cliente. */
export const clientNotes = pgTable(
  'client_notes',
  {
    id: pk(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clientProfiles.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    pinned: boolean('pinned').notNull().default(false),
    ...timestamps(),
  },
  (t) => [index('client_notes_client_idx').on(t.clientId)],
)
