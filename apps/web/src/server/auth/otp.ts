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

import { users } from '@studio/db'
import { eq } from 'drizzle-orm'
import { ehTeste } from '@/lib/ambiente'
import { db } from '@/lib/db'
import { canalEmailAtivo, enviarEmail, mascararEmail } from '@/server/notifications/email'
import { VALIDADE_MIN, consumirCodigo, criarCodigo, emEspera, queimarCodigos } from './codigo'
import { createSession } from './session'

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
    console.log(`[otp] código para ${destino ?? 'sem destino'}: ${code} (expira em ${VALIDADE_MIN}min)`)
    return true
  }

  const resultado = await enviarEmail({
    para: destino,
    assunto: `${code} é o seu código de acesso`,
    texto: [
      `Seu código de acesso é ${code}.`,
      '',
      `Ele vale por ${VALIDADE_MIN} minutos e só pode ser usado uma vez.`,
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

  if (await emEspera(phone, 'login')) {
    return { ok: false, message: 'Aguarde um minuto antes de pedir outro código.' }
  }

  const code = await criarCodigo(phone, 'login')

  if (!(await entregarCodigo(user.email, code))) {
    await queimarCodigos(phone, 'login')
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
  const conferido = await consumirCodigo(phone, 'login', code)
  if (!conferido.ok) return conferido

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
