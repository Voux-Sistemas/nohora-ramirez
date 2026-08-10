import 'server-only'

/**
 * Login da cliente por código de uso único.
 *
 * ── Por que e-mail e não WhatsApp ─────────────────────────────────────────
 * Mandar mensagem pela Cloud API do WhatsApp custa por conversa, exige conta
 * comercial verificada e template aprovado pela Meta — semanas de processo
 * para uma linha de seis dígitos. E-mail é de graça na escala de um salão, sai
 * em segundos e não depende de aprovação de ninguém. O WhatsApp continua no
 * produto onde ele é bom e gratuito: o link que a recepção clica para falar
 * com a cliente.
 *
 * ── A identidade continua sendo o telefone ────────────────────────────────
 * É o que a cliente deu no balcão e o que ela lembra. O e-mail é só o
 * envelope: descoberto a partir do telefone, nunca digitado no login. Assim
 * ninguém entra sabendo o e-mail de alguém, e a tela não vira uma ferramenta
 * para descobrir qual e-mail pertence a qual número.
 */

import { authOtps, users } from '@studio/db'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { ehTeste } from '@/lib/ambiente'
import { db } from '@/lib/db'
import { canalEmailAtivo, enviarEmail, mascararEmail } from '@/server/notifications/email'
import { hashSecret, randomOtpCode, verifySecret } from './crypto'
import { createSession } from './session'

const CODE_TTL_MIN = 5
const RESEND_COOLDOWN_SEC = 60
const MAX_ATTEMPTS = 5

/**
 * A porta da área da cliente só abre quando existe por onde mandar o código:
 * um canal de e-mail configurado, ou o ambiente de teste, onde o código volta
 * na própria tela. A tela e a ação usam a mesma resposta — senão o formulário
 * aparece para quem não vai conseguir entrar.
 */
export function loginClienteDisponivel(): boolean {
  return canalEmailAtivo() || ehTeste()
}

const SEM_EMAIL =
  'Sua conta não tem e-mail cadastrado, e é por ele que mandamos o código. Fale com o salão para cadastrar o seu.'
const FALHOU =
  'Não conseguimos enviar o código agora. Tente de novo em alguns minutos ou fale com o salão.'

async function entregarCodigo(destino: string | null, code: string): Promise<boolean> {
  /* Sem canal configurado o código vai para o log do servidor. Só serve em
     desenvolvimento — em produção `requestOtp` nem chega aqui sem canal. */
  if (!canalEmailAtivo() || !destino) {
    // eslint-disable-next-line no-console
    console.log(`[otp] código para ${destino ?? 'sem destino'}: ${code} (expira em ${CODE_TTL_MIN}min)`)
    return true
  }

  const resultado = await enviarEmail({
    para: destino,
    assunto: `${code} é o seu código de acesso`,
    texto: [
      `Seu código de acesso é ${code}.`,
      '',
      `Ele vale por ${CODE_TTL_MIN} minutos e só pode ser usado uma vez.`,
      '',
      'Se não foi você que pediu, ignore este e-mail — ninguém entra na sua conta sem este código.',
    ].join('\n'),
  })

  if (!resultado.ok) {
    // eslint-disable-next-line no-console
    console.error('[otp] falha ao enviar:', resultado.erro)
  }
  return resultado.ok
}

export interface RequestOtpResult {
  ok: boolean
  message?: string
  /** Para onde o código foi, já mascarado — a tela seguinte diz qual caixa abrir. */
  destino?: string
  /** Só preenchido fora de produção, para testar sem canal de envio. */
  devCode?: string
}

export async function requestOtp(phone: string): Promise<RequestOtpResult> {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)
  if (!user) {
    return { ok: false, message: 'Não encontramos conta com esse telefone. Agende um horário para criar a sua.' }
  }

  /* Antes de gravar código nenhum: sem envelope não há envio, e uma linha em
     `auth_otps` que ninguém vai poder usar é lixo com data de validade. */
  if (canalEmailAtivo() && !user.email) return { ok: false, message: SEM_EMAIL }

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

  const entregue = await entregarCodigo(user.email, code)
  if (!entregue) {
    /* Queima o código que não chegou a lugar nenhum. Sem isto ele continuaria
       válido por cinco minutos, e o cooldown impediria a cliente de pedir
       outro — ela ficaria trancada esperando uma mensagem que não vem. */
    await db.update(authOtps).set({ consumedAt: new Date() }).where(eq(authOtps.phone, phone))
    return { ok: false, message: FALHOU }
  }

  return {
    ok: true,
    destino: user.email ? mascararEmail(user.email) : undefined,
    devCode: ehTeste() ? code : undefined,
  }
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
