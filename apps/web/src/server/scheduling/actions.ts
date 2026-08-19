'use server'

/**
 * Ações da recepção.
 *
 * Nada aqui escreve no banco por conta própria: tudo passa por `book.ts`, que é
 * quem abre transação, apaga os blocos e traduz a violação de exclusão. Esta
 * camada valida o que veio do formulário, confere quem está pedindo e manda
 * revalidar a tela.
 *
 * As duas ações não conferiam nada. O botão só aparece para quem entrou, mas
 * server action é endereço HTTP: bastava conhecer o id de um atendimento para
 * cancelá-lo sem sessão nenhuma. Esconder o botão é desenho; o porteiro é aqui.
 */

import { notificationLogs } from '@studio/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { podeGerir, requireAcesso, veUnidade, type Acesso } from '@/server/auth/permissoes'
import {
  advanceStatus,
  cancelAppointment,
  JA_CANCELADA,
  type CancelStatus,
  type LiveStatus,
} from './book'
import { getAppointment, type AppointmentView } from './queries'

const LIVE_STATUSES = new Set<string>([
  'scheduled',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
])

const CANCEL_STATUSES = new Set<string>([
  'cancelled_by_client',
  'cancelled_by_studio',
  'no_show',
])

const NEGADO = 'sem permissão para esta ação'

/**
 * Quem pode tocar NESTE atendimento.
 *
 * A pergunta é sobre a linha, não sobre a tela: a unidade tem de estar no
 * alcance de quem pede, e quem não é gestão só mexe no atendimento em que a
 * própria mão está — `precisaGerir` marca o que nem isso permite.
 *
 * Devolve o que já teve de ir buscar para decidir: quem pede e o atendimento.
 * A confirmação precisa dos dois — do atendimento para escrever a mensagem, de
 * quem pede para assinar o registo — e assim não os lê uma segunda vez.
 */
async function autorizar(
  id: string,
  opcoes: { precisaGerir: boolean },
): Promise<{ acesso: Acesso; appointment: AppointmentView }> {
  const acesso = await requireAcesso()
  const appointment = await getAppointment(id)
  if (!appointment) throw new Error('atendimento não encontrado')
  if (!veUnidade(acesso, appointment.unitId)) throw new Error(NEGADO)

  if (podeGerir(acesso)) return { acesso, appointment }
  if (opcoes.precisaGerir) throw new Error(NEGADO)
  const meu = appointment.items.some((item) => item.staffId === acesso.staffId)
  if (!meu) throw new Error(NEGADO)

  return { acesso, appointment }
}

export async function mudarStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('para') ?? '')
  if (!id || !LIVE_STATUSES.has(to)) return

  await autorizar(id, { precisaGerir: false })

  /*
    Este formulário não tem canal de erro — é `action={mudarStatus}` cru, e uma
    excepção aqui troca a agenda inteira pela página de erro genérica. Mas a
    recusa que interessa não é um erro do lado de quem carregou: é o painel
    aberto noutro separador antes de alguém cancelar, e o botão "Confirmar" que
    ficou lá de um estado que já não existe.
    Engolir a recusa e revalidar é a resposta certa nesse caso — o ecrã
    reaparece com a verdade, sem o cartão morto e sem os botões. Qualquer outra
    falha continua a subir.
  */
  try {
    await advanceStatus(id, to as LiveStatus)
  } catch (e) {
    if (!(e instanceof Error) || e.message !== JA_CANCELADA) throw e
  }

  revalidateAgenda()
}

export async function cancelarAgendamento(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('para') ?? '')
  const reason = String(formData.get('motivo') ?? '').trim()
  if (!id || !CANCEL_STATUSES.has(to)) return

  await autorizar(id, { precisaGerir: true })
  await cancelAppointment(id, to as CancelStatus, reason ? { reason } : {})
  revalidateAgenda()
}

/**
 * Dar a confirmação por enviada.
 *
 * O envio em si não passa por aqui: quem entrega é o WhatsApp do telemóvel da
 * profissional, e o que o botão faz no browser é abrir a conversa com o texto
 * escrito. Isto é o registo — a prova de que aquela cliente já recebeu recado,
 * que é o que a tira da fila de `/avisos` e o que acende a marca na grelha da
 * dona.
 *
 * `precisaGerir: false` de propósito: a confirmação é dever de quem atende, e
 * quem atende passa por ter mão no atendimento. É o mesmo portão do "cheguei,
 * comecei, terminei".
 *
 * Enviar NÃO mexe no estado do atendimento. "Confirmado" quer dizer que a
 * cliente disse que vem; isto quer dizer que a casa lhe escreveu. Fazer o botão
 * avançar o estado era dar por confirmada quem ainda nem leu a mensagem.
 */
export async function enviarConfirmacao(id: string): Promise<void> {
  const { acesso, appointment } = await autorizar(id, { precisaGerir: false })

  /* Duas profissionais no mesmo atendimento, cada uma no seu telemóvel: sem
     esta leitura, a cliente levava a mesma mensagem duas vezes. Não é uma trava
     de corrida — é o caso normal de quem abre a agenda ao mesmo tempo. */
  if (appointment.confirmacaoEnviadaEm !== null) return

  await db.insert(notificationLogs).values({
    channel: 'whatsapp',
    templateKey: 'confirmacao',
    refType: 'appointment',
    refId: id,
    destination: appointment.clientPhone,
    status: 'sent',
    sentAt: new Date(),
    // Sem custo por mensagem: quem entrega é o WhatsApp de quem carregou.
    costCents: 0,
    /* Quem enviou vai no payload e não em coluna própria: é para auditoria
       pontual ("quem confirmou a Marina?"), não para contar por pessoa. No dia
       em que virar métrica, vira coluna. */
    payload: { via: 'agenda', enviadoPor: acesso.session.userId },
  })

  revalidateAgenda()
}

/** Tirar a marca. O clique não prova entrega, e às vezes o WhatsApp nem abre. */
export async function desfazerConfirmacao(id: string): Promise<void> {
  await autorizar(id, { precisaGerir: false })

  await db
    .delete(notificationLogs)
    .where(
      and(
        eq(notificationLogs.refType, 'appointment'),
        eq(notificationLogs.refId, id),
        eq(notificationLogs.templateKey, 'confirmacao'),
      ),
    )

  revalidateAgenda()
}

function revalidateAgenda(): void {
  revalidatePath('/agenda/[unidade]', 'page')
  revalidatePath('/')
}
