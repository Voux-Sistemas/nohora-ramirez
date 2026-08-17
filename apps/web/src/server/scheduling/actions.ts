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

import { revalidatePath } from 'next/cache'
import { podeGerir, requireAcesso, veUnidade } from '@/server/auth/permissoes'
import {
  advanceStatus,
  cancelAppointment,
  JA_CANCELADA,
  type CancelStatus,
  type LiveStatus,
} from './book'
import { getAppointment } from './queries'

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
 */
async function autorizar(id: string, opcoes: { precisaGerir: boolean }): Promise<void> {
  const acesso = await requireAcesso()
  const appointment = await getAppointment(id)
  if (!appointment) throw new Error('atendimento não encontrado')
  if (!veUnidade(acesso, appointment.unitId)) throw new Error(NEGADO)

  if (podeGerir(acesso)) return
  if (opcoes.precisaGerir) throw new Error(NEGADO)
  const meu = appointment.items.some((item) => item.staffId === acesso.staffId)
  if (!meu) throw new Error(NEGADO)
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

function revalidateAgenda(): void {
  revalidatePath('/agenda/[unidade]', 'page')
  revalidatePath('/')
}
