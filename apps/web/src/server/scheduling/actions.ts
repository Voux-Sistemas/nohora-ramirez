'use server'

/**
 * Ações da recepção.
 *
 * Nada aqui escreve no banco por conta própria: tudo passa por `book.ts`, que é
 * quem abre transação, apaga os blocos e traduz a violação de exclusão. Esta
 * camada só valida o que veio do formulário e manda revalidar a tela.
 */

import { revalidatePath } from 'next/cache'
import {
  advanceStatus,
  cancelAppointment,
  type CancelStatus,
  type LiveStatus,
} from './book'

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

export async function mudarStatus(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('para') ?? '')
  if (!id || !LIVE_STATUSES.has(to)) return

  await advanceStatus(id, to as LiveStatus)
  revalidateAgenda()
}

export async function cancelarAgendamento(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const to = String(formData.get('para') ?? '')
  const reason = String(formData.get('motivo') ?? '').trim()
  if (!id || !CANCEL_STATUSES.has(to)) return

  await cancelAppointment(id, to as CancelStatus, reason ? { reason } : {})
  revalidateAgenda()
}

function revalidateAgenda(): void {
  revalidatePath('/agenda/[unidade]', 'page')
  revalidatePath('/')
}
