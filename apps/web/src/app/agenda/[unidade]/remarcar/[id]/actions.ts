'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { rescheduleAppointment } from '@/server/scheduling/book'

/**
 * Remarcar é liberar e reservar na MESMA transação (ver `book.ts`). Se o novo
 * horário for tomado no meio do caminho, a cliente continua com o antigo — em
 * nenhum instante ela fica sem horário.
 */
export async function remarcar(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const unidade = String(formData.get('unidade') ?? '')
  const data = String(formData.get('data') ?? '')
  const inicio = String(formData.get('inicio') ?? '')
  const servicos = String(formData.get('servicos') ?? '')
  const profissional = String(formData.get('profissional') ?? '')
  const clientId = String(formData.get('cliente') ?? '')
  if (!id || !unidade || !inicio || !servicos || !clientId) return

  const result = await rescheduleAppointment(id, {
    unitSlug: unidade,
    clientId,
    cart: servicos
      .split(',')
      .filter(Boolean)
      .map((serviceId) => ({
        serviceId,
        ...(profissional ? { staffId: profissional } : {}),
      })),
    start: inicio,
    source: 'reception',
    channel: 'reception',
  })

  if (!result.ok) {
    redirect(
      `/agenda/${unidade}/remarcar/${id}?d=${data}&erro=${encodeURIComponent(result.message)}`,
    )
  }

  revalidatePath('/agenda/[unidade]', 'page')
  redirect(`/agenda/${unidade}?d=${data}&sel=${result.appointmentId}`)
}
