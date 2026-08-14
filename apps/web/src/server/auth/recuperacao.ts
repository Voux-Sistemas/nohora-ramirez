import 'server-only'

/**
 * A saída para quem da equipe esquecer a senha.
 *
 * ── Por que isso precisa existir ──────────────────────────────────────────
 * A dona é a única pessoa que pode criar contas de equipe. Se ela perder a
 * senha dela, não há a quem recorrer dentro do sistema: a conta que
 * destravaria a situação é justamente a que está trancada. Sem esta porta, o
 * salão fica dependendo de alguém abrir o banco na mão.
 *
 * ── Por que ela não é perigosa ────────────────────────────────────────────
 * O código vai para o e-mail já cadastrado na conta — nunca para um e-mail
 * digitado na hora. Quem não tem acesso àquela caixa não troca senha nenhuma,
 * e quem tem o telefone de alguém não descobre por aqui nem se a conta existe:
 * a resposta é a mesma para telefone que existe e telefone que não existe.
 *
 * ── Por que ela pode estar fechada ────────────────────────────────────────
 * Sem canal de e-mail configurado não há para onde mandar. Aí a porta some da
 * tela e a saída é a manual, documentada em `ops/README.md` — que continua
 * valendo mesmo depois, para o caso de a pessoa ter perdido também o e-mail.
 */

import { userRoles, users } from '@studio/db'
import { eq } from 'drizzle-orm'
import { ehTeste } from '@/lib/ambiente'
import { db } from '@/lib/db'
import { canalEmailAtivo, enviarEmail, mascararEmail } from '@/server/notifications/email'
import { VALIDADE_MIN, consumirCodigo, criarCodigo, emEspera, queimarCodigos } from './codigo'
import { setStaffPassword } from './password'
import { temPapelDeEquipe } from './permissoes'
import { createSession, revokeAllSessions } from './session'

export const SENHA_MINIMA = 8

export function recuperacaoDisponivel(): boolean {
  return canalEmailAtivo() || ehTeste()
}

/**
 * A mesma frase para todos os becos sem saída: telefone que não existe, conta
 * de cliente, conta sem e-mail, conta desativada.
 *
 * Diferenciar seria didático e entregaria a lista de quem trabalha no salão a
 * quem só tem um telefone para testar. A pessoa certa tem o e-mail na mão e
 * segue em frente; a errada não aprende nada.
 */
const RESPOSTA_UNICA =
  'Se este telefone for de alguém da equipa, o código está a caminho do e-mail registado.'

export interface PedidoRecuperacao {
  ok: boolean
  message?: string
  /** Mascarado. Só vem quando o código saiu de verdade. */
  destino?: string
  /** Só fora de produção, para testar sem canal de envio. */
  devCode?: string
}

export async function pedirRecuperacao(phone: string): Promise<PedidoRecuperacao> {
  const [user] = await db
    .select({ id: users.id, email: users.email, status: users.status, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)

  /*
    Cada `return` abaixo devolve `ok: true` sem ter mandado nada. É de
    propósito: a tela seguinte diz "confira seu e-mail" em todos os casos, e
    quem está pescando telefones não descobre qual deles é da equipe. Quem é
    da casa e não recebe nada tem a instrução de falar com quem cuida do
    sistema — o caminho manual continua aberto.
  */
  if (!user || !user.passwordHash || user.status !== 'active' || !user.email) {
    return { ok: true, message: RESPOSTA_UNICA }
  }

  const papeis = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, user.id))
  if (!temPapelDeEquipe(papeis)) return { ok: true, message: RESPOSTA_UNICA }

  /* O cooldown responde igual aos outros becos: quem pediu há trinta segundos
     recebe a mesma frase e o e-mail que já está na caixa dele serve. */
  if (await emEspera(phone, 'recovery')) return { ok: true, message: RESPOSTA_UNICA }

  const code = await criarCodigo(phone, 'recovery')

  if (!canalEmailAtivo()) {
    /* Imprimir o código no log só se faz fora de produção: lá ele é uma
       credencial viva à vista de quem abrir o painel do Railway. Em produção
       sem canal não há por onde recuperar senha — e dizê-lo é melhor do que
       fingir que o e-mail saiu. */
    if (!ehTeste()) {
      await queimarCodigos(phone, 'recovery')
      return { ok: false, message: 'Não conseguimos enviar o código agora. Fale com quem cuida do sistema.' }
    }
    // eslint-disable-next-line no-console
    console.log(`[recuperacao] código para ${user.email}: ${code} (expira em ${VALIDADE_MIN}min)`)
    return { ok: true, destino: mascararEmail(user.email), devCode: code }
  }

  const envio = await enviarEmail({
    para: user.email,
    assunto: `${code} — código para trocar a sua palavra-passe`,
    texto: [
      `Alguém pediu para trocar a palavra-passe de acesso da equipa. O código é ${code}.`,
      '',
      `Ele vale por ${VALIDADE_MIN} minutos e só pode ser usado uma vez.`,
      '',
      'Se o pedido não partiu de si, ignore este e-mail: a sua palavra-passe continua',
      'a mesma e ninguém consegue trocá-la sem este código.',
    ].join('\n'),
  })

  if (!envio.ok) {
    console.error('[recuperacao] falha ao enviar:', envio.erro)
    await queimarCodigos(phone, 'recovery')
    return { ok: false, message: 'Não conseguimos enviar o código agora. Tente de novo em alguns minutos.' }
  }

  return { ok: true, destino: mascararEmail(user.email), devCode: ehTeste() ? code : undefined }
}

export interface TrocaDeSenha {
  ok: boolean
  message?: string
}

/**
 * Confere o código e grava a senha nova numa tacada só.
 *
 * Sem etapa intermediária de propósito: um "código conferido, agora escolha a
 * senha" precisaria carregar uma permissão temporária entre duas telas, e essa
 * permissão é exatamente o que um atacante gostaria de roubar. Aqui o código é
 * gasto no mesmo envio que já traz a senha nova.
 */
export async function trocarSenhaComCodigo(
  phone: string,
  code: string,
  senha: string,
): Promise<TrocaDeSenha> {
  if (senha.length < SENHA_MINIMA) {
    return { ok: false, message: `A palavra-passe tem de ter pelo menos ${SENHA_MINIMA} caracteres.` }
  }

  const conferido = await consumirCodigo(phone, 'recovery', code)
  if (!conferido.ok) return conferido

  const [user] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1)
  if (!user || user.status !== 'active') return { ok: false, message: 'Conta não encontrada.' }

  await setStaffPassword(user.id, senha)
  await revokeAllSessions(user.id)
  await createSession(user.id)

  return { ok: true }
}
