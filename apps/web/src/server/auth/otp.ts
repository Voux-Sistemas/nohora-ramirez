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

/**
 * A única resposta que a tela dá quando não houve envio — conta que não
 * existe, ficha sem e-mail, pedido repetido dentro do minuto.
 *
 * Antes cada um desses becos tinha a sua frase, e "Não encontramos conta com
 * esse telefone" respondia, a quem escrevesse números no formulário público,
 * quais deles são de clientes deste salão. Isso é dado pessoal por dedução: a
 * lista de quem frequenta uma casa de beleza não é do público, mesmo que cada
 * número, isolado, não seja segredo. A frase agora é a mesma em todos os
 * casos, e quem é da casa e não recebeu nada tem o caminho de sempre — ligar
 * para o salão.
 *
 * Fica de fora um sinal fraco, e de propósito: quando o envio corre bem a tela
 * seguinte mostra o e-mail mascarado, e quando não corre não mostra. É o mesmo
 * compromisso que `recuperacao.ts` já fazia, pela mesma razão — a cliente
 * precisa de saber que caixa abrir.
 */
const RESPOSTA_UNICA =
  'Se houver conta com este número, o código já foi para o e-mail registado na ficha. ' +
  'Não chegou nada? Fale com o salão — pode não haver e-mail na sua ficha ainda.'
const FALHOU =
  'Não conseguimos enviar o código agora. Tente de novo em alguns minutos ou fale com o salão.'

async function entregarCodigo(destino: string | null, code: string): Promise<boolean> {
  /*
    Sem canal configurado o código vai para o log do servidor — mas **só fora
    de produção**. O log do Railway fica legível a quem tiver o painel, e um
    código de acesso impresso lá é uma credencial viva à espera de ser lida.
    `loginClienteDisponivel` já fecha a porta em produção sem canal; o
    `ehTeste()` aqui é a segunda tranca, para o dia em que alguém abrir a
    primeira sem reparar nesta.
  */
  if (!canalEmailAtivo() || !destino) {
    if (!ehTeste()) return false
    // eslint-disable-next-line no-console
    console.log(`[otp] código para ${destino ?? 'sem destino'}: ${code} (expira em ${VALIDADE_MIN}min)`)
    return true
  }

  const resultado = await enviarEmail({
    para: destino,
    assunto: `${code} é o seu código de acesso`,
    texto: [
      `O seu código de acesso é ${code}.`,
      '',
      `Ele vale por ${VALIDADE_MIN} minutos e só pode ser usado uma vez.`,
      '',
      'Se o pedido não partiu de si, ignore este e-mail — ninguém entra na sua conta sem este código.',
    ].join('\n'),
  })

  if (!resultado.ok) {
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
  /* Antes de gravar código nenhum: sem conta e sem envelope não há envio, e
     uma linha em `auth_otps` que ninguém vai poder usar é lixo com data de
     validade. Os três becos respondem igual — ver `RESPOSTA_UNICA`. */
  if (!user) return { ok: true, message: RESPOSTA_UNICA }
  if (canalEmailAtivo() && !user.email) return { ok: true, message: RESPOSTA_UNICA }
  if (await emEspera(phone, 'login')) return { ok: true, message: RESPOSTA_UNICA }

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
