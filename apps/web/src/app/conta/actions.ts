'use server'

/**
 * Ações da cliente logada. Diferente da recepção (@/server/scheduling/actions),
 * aqui a cliente só pode mexer no próprio agendamento — cada ação confere a
 * sessão antes de tocar no banco.
 */

import { revalidatePath } from 'next/cache'
import { cancelAppointment } from '@/server/scheduling/book'
import { getAppointment } from '@/server/scheduling/queries'
import { requireClientSession } from '@/server/auth/session'

const CANCELABLE = new Set(['draft', 'scheduled', 'confirmed', 'checked_in'])

export interface CancelState {
  error?: string
}

export async function cancelarMeuAgendamento(
  _state: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const session = await requireClientSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Marcação não encontrada.' }

  const appointment = await getAppointment(id)
  if (!appointment || appointment.clientId !== session.clientId) {
    return { error: 'Marcação não encontrada.' }
  }
  if (!CANCELABLE.has(appointment.status)) {
    return { error: 'Esta marcação já não pode ser cancelada.' }
  }

  await cancelAppointment(id, 'cancelled_by_client', { reason: 'Cancelado pela cliente' })
  revalidatePath('/conta')
  return {}
}
