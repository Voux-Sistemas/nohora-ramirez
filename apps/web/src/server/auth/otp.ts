import 'server-only'

/**
 * Login da cliente por código de uso único enviado ao telefone.
 *
 * O ENVIO em si (WhatsApp) fica para depois — é a parte que a dona ainda vai
 * decidir se integra. `deliverOtpCode` é o único ponto que vai mudar quando
 * isso for ligado; por ora só registra no log do servidor e, fora de
 * produção, devolve o código na resposta para dar para testar sem WhatsApp.
 */

import { authOtps, users } from '@studio/db'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { ehTeste } from '@/lib/ambiente'
import { db } from '@/lib/db'
import { hashSecret, randomOtpCode, verifySecret } from './crypto'
import { createSession } from './session'

const CODE_TTL_MIN = 5
const RESEND_COOLDOWN_SEC = 60
const MAX_ATTEMPTS = 5

function deliverOtpCode(phone: string, code: string): void {
  // eslint-disable-next-line no-console
  console.log(`[otp] código para ${phone}: ${code} (expira em ${CODE_TTL_MIN}min)`)
}

export interface RequestOtpResult {
  ok: boolean
  message?: string
  /** Só preenchido fora de produção, para testar sem canal de envio. */
  devCode?: string
}

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1)
  if (!user) {
    return { ok: false, message: 'Não encontramos conta com esse telefone. Agende um horário para criar a sua.' }
  }

  const [recent] = await db
    .select({ createdAt: authOtps.createdAt })
    .from(authOtps)
    .where(eq(authOtps.phone, phone))
    .orderBy(desc(authOtps.createdAt))
    .limit(1)
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_SEC * 1000) {
    return { ok: false, message: 'Aguarde um minuto antes de pedir outro código.' }
  }

  const code = randomOtpCode()
  const codeHash = await hashSecret(code)
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000)

  await db.insert(authOtps).values({ phone, codeHash, expiresAt })
  deliverOtpCode(phone, code)

  return { ok: true, devCode: ehTeste() ? code : undefined }
}

export interface VerifyOtpResult {
  ok: boolean
  message?: string
}

export async function verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
  const [otp] = await db
    .select()
    .from(authOtps)
    .where(and(eq(authOtps.phone, phone), isNull(authOtps.consumedAt), gt(authOtps.expiresAt, new Date())))
    .orderBy(desc(authOtps.createdAt))
    .limit(1)

  if (!otp) return { ok: false, message: 'Código expirado ou inexistente. Peça um novo.' }
  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.update(authOtps).set({ consumedAt: new Date() }).where(eq(authOtps.id, otp.id))
    return { ok: false, message: 'Muitas tentativas. Peça um novo código.' }
  }

  const valid = await verifySecret(code, otp.codeHash)
  if (!valid) {
    await db.update(authOtps).set({ attempts: otp.attempts + 1 }).where(eq(authOtps.id, otp.id))
    return { ok: false, message: 'Código incorreto.' }
  }

  await db.update(authOtps).set({ consumedAt: new Date() }).where(eq(authOtps.id, otp.id))

  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1)
  if (!user) return { ok: false, message: 'Conta não encontrada.' }

  await createSession(user.id)
  return { ok: true }
}

/** Atalho de teste: pula o OTP e entra direto, para quando o alias "cliente" é usado. */
export async function loginTestClient(phone: string): Promise<VerifyOtpResult> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1)
  if (!user) return { ok: false, message: 'Conta não encontrada.' }

  await createSession(user.id)
  return { ok: true }
}
