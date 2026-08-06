import 'server-only'

/**
 * Sessão por cookie httpOnly. O token cru só existe no navegador — o banco
 * guarda o hash, então um vazamento do banco não dá login a ninguém.
 */

import { clientProfiles, sessions, staffProfiles, userRoles, users } from '@studio/db'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { randomToken, sha256Hex } from './crypto'

const COOKIE_NAME = 'sid'
const SESSION_DAYS = 30

export interface SessionUser {
  userId: string
  name: string
  phone: string
  roles: { role: string; unitId: string | null }[]
  clientId: string | null
  staffId: string | null
}

export async function createSession(
  userId: string,
  meta?: { userAgent?: string; ip?: string },
): Promise<void> {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(sessions).values({
    userId,
    tokenHash: sha256Hex(token),
    expiresAt,
    userAgent: meta?.userAgent,
    ip: meta?.ip,
  })

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (token) {
    await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256Hex(token)))
  }
  store.delete(COOKIE_NAME)
}

/**
 * Lê a sessão do cookie atual, ou `null` se não houver uma válida.
 * Sem cache entre chamadas na mesma requisição de propósito — o volume de
 * leitura por requisição é baixo e a simplicidade vale mais aqui.
 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  const [row] = await db
    .select({
      userId: users.id,
      name: users.name,
      phone: users.phone,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, sha256Hex(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!row) return null

  const [roles, clientProfile, staffProfile] = await Promise.all([
    db.select({ role: userRoles.role, unitId: userRoles.unitId }).from(userRoles).where(eq(userRoles.userId, row.userId)),
    db.select({ id: clientProfiles.id }).from(clientProfiles).where(eq(clientProfiles.userId, row.userId)).limit(1),
    db.select({ id: staffProfiles.id }).from(staffProfiles).where(eq(staffProfiles.userId, row.userId)).limit(1),
  ])

  return {
    ...row,
    roles,
    clientId: clientProfile[0]?.id ?? null,
    staffId: staffProfile[0]?.id ?? null,
  }
}

/** Redireciona para o login da equipe se não houver sessão com algum papel de equipe. */
export async function requireStaffSession(): Promise<SessionUser> {
  const session = await getSession()
  const isStaff = session?.roles.some((r) => r.role !== 'client') ?? false
  if (!session || !isStaff) redirect('/entrar')
  return session
}

/** Redireciona para o login da cliente se não houver sessão com papel de cliente. */
export async function requireClientSession(): Promise<SessionUser> {
  const session = await getSession()
  if (!session || !session.clientId) redirect('/conta/entrar')
  return session
}
