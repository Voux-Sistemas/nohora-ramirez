import 'server-only'

/** Login da equipe por telefone + senha. Cliente nunca tem senha — entra por OTP. */

import { staffProfiles, userRoles, users } from '@studio/db'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { hashSecret, precisaRehash, verifySecret } from './crypto'
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
  if (!user || !user.passwordHash) return { ok: false, message: 'Telefone ou palavra-passe incorretos.' }

  /*
    A pergunta é a mesma que os porteiros de tela fazem, e por isso vem do mesmo
    lugar. Aceitar aqui "qualquer papel diferente de cliente" deixaria alguém com
    um papel não implementado (`receptionist`, `finance`) entrar no login e ser
    devolvido para o login na tela seguinte — um laço sem explicação.
  */
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id))
  if (!temPapelDeEquipe(roles)) return { ok: false, message: 'Telefone ou palavra-passe incorretos.' }

  const valid = await verifySecret(plain, user.passwordHash)
  if (!valid) return { ok: false, message: 'Telefone ou palavra-passe incorretos.' }

  if (user.status !== 'active') return { ok: false, message: 'Conta desativada. Fale com a administração.' }

  /*
    A mesma pergunta que `acessoDe` faz, feita aqui também. Sem ela a senha
    ainda era aceite, a sessão nascia, e a tela seguinte devolvia a pessoa para
    o login sem dizer porquê — um laço em que se digita a senha certa e não se
    entra. Uma frase honesta custa uma consulta.
  */
  const [perfil] = await db
    .select({ active: staffProfiles.active })
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, user.id))
    .limit(1)
  if (perfil && !perfil.active) {
    return { ok: false, message: 'Este acesso está desativado. Fale com a administração.' }
  }

  /*
    Único instante em que a senha em claro existe e a pessoa já provou ser dona
    dela: é aqui, e só aqui, que dá para regravar um hash antigo com o custo de
    hoje sem lhe pedir nada. Quem não voltar a entrar fica com o hash fraco —
    mas quem não volta a entrar também não tem conta a proteger.
  */
  if (precisaRehash(user.passwordHash)) await setStaffPassword(user.id, plain)

  await createSession(user.id)
  return { ok: true }
}
