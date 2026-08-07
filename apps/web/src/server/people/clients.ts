import 'server-only'

/**
 * Identificação da cliente.
 *
 * O telefone é a chave: é único em `users` e é o mesmo nas três unidades, então
 * quem já foi atendida no Centro é reconhecida no Jardins com histórico e tudo.
 *
 * Aqui NÃO há verificação de posse do número — isso é papel do OTP, que entra
 * junto com a autenticação. Enquanto isso, o cadastro leve permite agendar; o
 * agendamento só passa a ser "confiável" quando o login existir.
 */

import { clientNotes, clientProfiles, staffProfiles, units, userRoles, users } from '@studio/db'
import { and, asc, desc, eq, ilike, like, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { toE164 } from '@/lib/format'

export interface ClientIdentity {
  /** `client_profiles.id` — é o que a agenda referencia. */
  clientId: string
  userId: string
  name: string
  phone: string
  /** Já existia antes desta chamada. */
  returning: boolean
}

export async function findOrCreateClient(input: {
  /** E.164. */
  phone: string
  name: string
  /**
   * Opcional. Só preenche quem ainda não tem — nunca sobrescreve. Um e-mail
   * digitado errado no agendamento não pode apagar o endereço bom que a
   * recepção cadastrou na ficha.
   */
  email?: string
  preferredUnitId?: string
}): Promise<ClientIdentity> {
  const existing = await db
    .select({
      userId: users.id,
      name: users.name,
      phone: users.phone,
      clientId: clientProfiles.id,
    })
    .from(users)
    .leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
    .where(eq(users.phone, input.phone))
    .limit(1)

  const found = existing[0]
  const email = input.email?.trim() || undefined

  if (found?.clientId) {
    if (email) await fillEmailIfMissing(db, found.userId, email)
    return {
      clientId: found.clientId,
      userId: found.userId,
      name: found.name,
      phone: found.phone,
      returning: true,
    }
  }

  return db.transaction(async (tx) => {
    // pode existir como profissional e nunca como cliente — aí só falta o perfil
    const userId =
      found?.userId ??
      (
        await tx
          .insert(users)
          .values({ phone: input.phone, name: input.name, ...(email ? { email } : {}) })
          .returning({ id: users.id })
      )[0]!.id

    if (found?.userId && email) await fillEmailIfMissing(tx, userId, email)

    const [profile] = await tx
      .insert(clientProfiles)
      .values({
        userId,
        ...(input.preferredUnitId ? { preferredUnitId: input.preferredUnitId } : {}),
      })
      .returning({ id: clientProfiles.id })

    await tx
      .insert(userRoles)
      .values({ userId, role: 'client' })
      .onConflictDoNothing()

    return {
      clientId: profile!.id,
      userId,
      name: found?.name ?? input.name,
      phone: input.phone,
      returning: found !== undefined,
    }
  })
}

/** Vale para `db` e para a transação — a regra é a mesma nos dois. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * O `is null` no WHERE é a regra inteira, e ela vive no banco de propósito: sem
 * ele, duas chamadas concorrentes decidiriam pelo que leram antes e a última a
 * gravar venceria.
 */
async function fillEmailIfMissing(exec: Executor, userId: string, email: string): Promise<void> {
  await exec
    .update(users)
    .set({ email })
    .where(and(eq(users.id, userId), sql`${users.email} is null`))
}

export interface ImportRow {
  name: string
  phone: string
  email?: string
}

export interface ImportResult {
  created: number
  updated: number
  skipped: { row: number; name: string; reason: string }[]
}

/**
 * Importação em massa (CSV de onboarding). Reaproveita `findOrCreateClient`
 * pelo telefone — quem já existe (ex.: alguém que já agendou) só recebe o
 * e-mail se ele vier na planilha e ainda não tiver um cadastrado.
 */
export async function importClients(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: [] }

  for (const [index, row] of rows.entries()) {
    const name = row.name.trim()
    const phone = toE164(row.phone)
    if (!name || !phone) {
      result.skipped.push({ row: index + 1, name: row.name || '(sem nome)', reason: 'nome ou telefone inválido' })
      continue
    }

    const client = await findOrCreateClient({ phone, name, ...(row.email ? { email: row.email } : {}) })
    if (client.returning) {
      result.updated++
    } else {
      result.created++
    }
  }

  return result
}

export async function getClientById(clientId: string): Promise<ClientIdentity | null> {
  const [row] = await db
    .select({
      clientId: clientProfiles.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(eq(clientProfiles.id, clientId))
    .limit(1)

  return row ? { ...row, returning: true } : null
}

/** Busca por nome ou telefone — é o campo de busca da recepção. */
export async function searchClients(term: string, limit = 12): Promise<ClientIdentity[]> {
  const clean = term.trim()
  if (clean.length < 2) return []

  // quem digita número está procurando telefone; quem digita letra, nome
  const digits = clean.replace(/\D/g, '')
  const match =
    digits.length >= 4 ? like(users.phone, `%${digits}%`) : ilike(users.name, `%${clean}%`)

  const rows = await db
    .select({
      clientId: clientProfiles.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(and(eq(users.status, 'active'), match))
    .orderBy(asc(users.name))
    .limit(limit)

  return rows.map((row) => ({ ...row, returning: true }))
}

export interface ClientDirectoryRow extends ClientIdentity {
  /** `null` = cadastrada e nunca atendida. */
  lastVisitAt: Date | null
  /** Marcada para pedir sinal — a recepção precisa ver isso antes de abrir a ficha. */
  requiresDeposit: boolean
}

/** Lista para navegar a base inteira — a busca por termo é a mesma de `searchClients`, sem o mínimo de 2 letras. */
export async function listClientsDirectory(term = '', limit = 60): Promise<ClientDirectoryRow[]> {
  const clean = term.trim()
  const digits = clean.replace(/\D/g, '')
  const match = clean
    ? digits.length >= 4
      ? like(users.phone, `%${digits}%`)
      : ilike(users.name, `%${clean}%`)
    : undefined

  const rows = await db
    .select({
      clientId: clientProfiles.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
      /* A última visita é o que transforma uma lista de nomes numa carteira:
         é por ela que a recepção sabe se está diante de uma cliente da casa
         ou de alguém que sumiu há um ano. Custa uma coluna na mesma linha. */
      lastVisitAt: clientProfiles.lastVisitAt,
      requiresDeposit: clientProfiles.requiresDeposit,
    })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(match ? and(eq(users.status, 'active'), match) : eq(users.status, 'active'))
    .orderBy(asc(users.name))
    .limit(limit)

  return rows.map((row) => ({ ...row, returning: true }))
}

export interface ClientProfileView {
  clientId: string
  userId: string
  name: string
  phone: string
  email: string | null
  birthdate: string | null
  document: string | null
  howFoundUs: string | null
  preferredUnitId: string | null
  preferredUnitName: string | null
  preferredStaffId: string | null
  preferredStaffName: string | null
  tags: string[]
  noShowCount: number
  requiresDeposit: boolean
  firstVisitAt: Date | null
  lastVisitAt: Date | null
  createdAt: Date
}

/** A ficha completa — é o que a tela de cliente lê para montar o formulário. */
export async function getClientProfile(clientId: string): Promise<ClientProfileView | null> {
  const preferredStaff = { id: staffProfiles.id, name: staffProfiles.displayName }
  const [row] = await db
    .select({
      clientId: clientProfiles.id,
      userId: users.id,
      name: users.name,
      phone: users.phone,
      email: users.email,
      birthdate: clientProfiles.birthdate,
      document: clientProfiles.document,
      howFoundUs: clientProfiles.howFoundUs,
      preferredUnitId: clientProfiles.preferredUnitId,
      preferredUnitName: units.name,
      preferredStaffId: clientProfiles.preferredStaffId,
      preferredStaffName: preferredStaff.name,
      tags: clientProfiles.tags,
      noShowCount: clientProfiles.noShowCount,
      requiresDeposit: clientProfiles.requiresDeposit,
      firstVisitAt: clientProfiles.firstVisitAt,
      lastVisitAt: clientProfiles.lastVisitAt,
      createdAt: clientProfiles.createdAt,
    })
    .from(clientProfiles)
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .leftJoin(units, eq(units.id, clientProfiles.preferredUnitId))
    .leftJoin(staffProfiles, eq(staffProfiles.id, clientProfiles.preferredStaffId))
    .where(eq(clientProfiles.id, clientId))
    .limit(1)

  return row ?? null
}

export interface ClientProfileInput {
  name: string
  phone: string
  email?: string
  birthdate?: string
  document?: string
  howFoundUs?: string
  preferredUnitId?: string
  preferredStaffId?: string
  tags: string[]
  requiresDeposit: boolean
}

export async function updateClientProfile(clientId: string, input: ClientProfileInput): Promise<void> {
  await db.transaction(async (tx) => {
    const [profile] = await tx
      .select({ userId: clientProfiles.userId })
      .from(clientProfiles)
      .where(eq(clientProfiles.id, clientId))
      .limit(1)
    if (!profile) throw new Error('cliente não encontrado')

    await tx
      .update(users)
      .set({ name: input.name, phone: input.phone, email: input.email || null })
      .where(eq(users.id, profile.userId))

    await tx
      .update(clientProfiles)
      .set({
        birthdate: input.birthdate || null,
        document: input.document || null,
        howFoundUs: input.howFoundUs || null,
        preferredUnitId: input.preferredUnitId || null,
        preferredStaffId: input.preferredStaffId || null,
        tags: input.tags,
        requiresDeposit: input.requiresDeposit,
      })
      .where(eq(clientProfiles.id, clientId))
  })
}

export interface ClientNoteView {
  id: string
  body: string
  pinned: boolean
  authorName: string | null
  createdAt: Date
}

/** Mais recentes primeiro, mas fixadas sempre no topo. */
export async function listClientNotes(clientId: string): Promise<ClientNoteView[]> {
  const rows = await db
    .select({
      id: clientNotes.id,
      body: clientNotes.body,
      pinned: clientNotes.pinned,
      authorName: users.name,
      createdAt: clientNotes.createdAt,
    })
    .from(clientNotes)
    .leftJoin(users, eq(users.id, clientNotes.authorId))
    .where(eq(clientNotes.clientId, clientId))
    .orderBy(desc(clientNotes.pinned), desc(clientNotes.createdAt))

  return rows
}

export async function addClientNote(clientId: string, body: string, pinned = false): Promise<void> {
  await db.insert(clientNotes).values({ clientId, body, pinned })
}

export async function toggleClientNotePin(noteId: string): Promise<void> {
  await db
    .update(clientNotes)
    .set({ pinned: sql`not ${clientNotes.pinned}` })
    .where(eq(clientNotes.id, noteId))
}

export async function removeClientNote(noteId: string): Promise<void> {
  await db.delete(clientNotes).where(eq(clientNotes.id, noteId))
}
