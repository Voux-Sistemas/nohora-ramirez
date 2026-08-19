import 'server-only'

/**
 * Códigos de seis dígitos, de uso único.
 *
 * Duas portas usam a mesma máquina: a cliente que entra na conta e a pessoa da
 * equipe que esqueceu a senha. O que muda entre elas é o `proposito` — e ele é
 * parte da chave, não um detalhe. Um código pedido para trocar senha não pode
 * ser aceito na porta do login, senão quem pede a coisa menor recebe a maior.
 *
 * Nada aqui manda mensagem. Quem chama decide por onde o código sai e o que
 * dizer se não sair; esta camada só cuida de gerar, guardar o hash e queimar.
 */

import { authOtps } from '@studio/db'
import { and, desc, eq, gt, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { hashSecret, randomOtpCode, verifySecret } from './crypto'

export const VALIDADE_MIN = 5
const COOLDOWN_SEC = 60
const MAX_TENTATIVAS = 5

/** Para que serve o código. Vira coluna, então o texto é o contrato do banco. */
export type Proposito = 'login' | 'recovery'

/**
 * Verdadeiro se o último pedido é recente demais.
 *
 * Existe para o mesmo telefone não virar máquina de disparar e-mail — e para
 * quem clica duas vezes no botão não receber dois códigos e usar o errado.
 */
export async function emEspera(phone: string, proposito: Proposito): Promise<boolean> {
  const [ultimo] = await db
    .select({ createdAt: authOtps.createdAt })
    .from(authOtps)
    .where(and(eq(authOtps.phone, phone), eq(authOtps.purpose, proposito)))
    .orderBy(desc(authOtps.createdAt))
    .limit(1)

  return !!ultimo && Date.now() - ultimo.createdAt.getTime() < COOLDOWN_SEC * 1000
}

/** Gera, guarda só o hash e devolve o código cru — que existe uma vez só, aqui. */
export async function criarCodigo(phone: string, proposito: Proposito): Promise<string> {
  const code = randomOtpCode()
  await db.insert(authOtps).values({
    phone,
    purpose: proposito,
    codeHash: await hashSecret(code),
    expiresAt: new Date(Date.now() + VALIDADE_MIN * 60 * 1000),
  })
  return code
}

/**
 * Invalida os códigos abertos deste telefone e propósito.
 *
 * Chamado quando o envio falha. Sem isso o código continuaria válido por cinco
 * minutos sem ter chegado a lugar nenhum, e o cooldown impediria a pessoa de
 * pedir outro: ela ficaria trancada esperando uma mensagem que não vem.
 */
export async function queimarCodigos(phone: string, proposito: Proposito): Promise<void> {
  await db
    .update(authOtps)
    .set({ consumedAt: new Date() })
    .where(and(eq(authOtps.phone, phone), eq(authOtps.purpose, proposito), isNull(authOtps.consumedAt)))
}

/** Por que o código não passou. Ver `ResultadoCodigo` para o porquê da chave. */
export type MotivoCodigo = 'expirado' | 'muitasTentativas' | 'incorreto'

/**
 * A recusa vem em dois formatos, e não é por indecisão.
 *
 * `message` é português fixo e serve as portas da EQUIPA — `/entrar`,
 * recuperação de palavra-passe — que não se traduzem. `motivo` é a chave, e
 * serve a porta da CLIENTE, que fala três línguas e vai buscar as palavras ao
 * dicionário. É o mesmo par que `book.ts` já usa para os erros de marcação.
 */
export type ResultadoCodigo = { ok: true } | { ok: false; motivo: MotivoCodigo; message: string }

/**
 * Confere e consome. Só devolve `ok` uma vez por código.
 *
 * As mensagens de erro não distinguem "não existe" de "expirou" com detalhe
 * demais de propósito: o que a pessoa precisa saber é que tem que pedir outro.
 */
export async function consumirCodigo(
  phone: string,
  proposito: Proposito,
  code: string,
): Promise<ResultadoCodigo> {
  const [otp] = await db
    .select()
    .from(authOtps)
    .where(
      and(
        eq(authOtps.phone, phone),
        eq(authOtps.purpose, proposito),
        isNull(authOtps.consumedAt),
        gt(authOtps.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(authOtps.createdAt))
    .limit(1)

  if (!otp) {
    return { ok: false, motivo: 'expirado', message: 'Código expirado ou inexistente. Peça um novo.' }
  }

  if (otp.attempts >= MAX_TENTATIVAS) {
    await db.update(authOtps).set({ consumedAt: new Date() }).where(eq(authOtps.id, otp.id))
    return { ok: false, motivo: 'muitasTentativas', message: 'Muitas tentativas. Peça um novo código.' }
  }

  if (!(await verifySecret(code, otp.codeHash))) {
    await db.update(authOtps).set({ attempts: otp.attempts + 1 }).where(eq(authOtps.id, otp.id))
    return { ok: false, motivo: 'incorreto', message: 'Código incorreto.' }
  }

  await db.update(authOtps).set({ consumedAt: new Date() }).where(eq(authOtps.id, otp.id))
  return { ok: true }
}
