import 'server-only'

/** Login da equipe por telefone + senha. Cliente nunca tem senha — entra por OTP. */

import { userRoles, users } from '@studio/db'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { hashSecret, verifySecret } from './crypto'
import { temPapelDeEquipe } from './permissoes'
import { createSession } from './session'

export async function setStaffPassword(userId: string, plain: string): Promise<void> {
  const passwordHash = await hashSecret(plain)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
}

export interface StaffLoginResult {
  ok: boolean
  message?: string
}

export async function verifyStaffLogin(phone: string, plain: string): Promise<StaffLoginResult> {
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1)
  if (!user || !user.passwordHash) return { ok: false, message: 'Telefone ou senha incorretos.' }

  /*
    A pergunta é a mesma que os porteiros de tela fazem, e por isso vem do mesmo
    lugar. Aceitar aqui "qualquer papel diferente de cliente" deixaria alguém com
    um papel não implementado (`receptionist`, `finance`) entrar no login e ser
    devolvido para o login na tela seguinte — um laço sem explicação.
  */
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id))
  if (!temPapelDeEquipe(roles)) return { ok: false, message: 'Telefone ou senha incorretos.' }

  const valid = await verifySecret(plain, user.passwordHash)
  if (!valid) return { ok: false, message: 'Telefone ou senha incorretos.' }

  if (user.status !== 'active') return { ok: false, message: 'Conta desativada. Fale com a administração.' }

  await createSession(user.id)
  return { ok: true }
}
