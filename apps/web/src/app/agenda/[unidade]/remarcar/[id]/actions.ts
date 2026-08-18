'use server'

import { revalidatePath } from 'next/cache'
import { redirect, RedirectType } from 'next/navigation'
import { assertUnidade } from '@/server/auth/permissoes'
import { rescheduleAppointment } from '@/server/scheduling/book'
import { getUnitBySlug } from '@/server/scheduling/context'
import { getAppointment } from '@/server/scheduling/queries'

/**
 * Remarcar é liberar e reservar na MESMA transação (ver `book.ts`). Se o novo
 * horário for tomado no meio do caminho, a cliente continua com o antigo — em
 * nenhum instante ela fica sem horário.
 *
 * Mover cliente é da gestão: exige enxergar a agenda das colegas para saber
 * para onde mover. E a permissão pergunta pela unidade DO ATENDIMENTO, não pela
 * que veio no formulário — quem forja o campo escolheria a loja onde tem acesso
 * para mexer no atendimento de outra.
 */
export async function remarcar(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const unidade = String(formData.get('unidade') ?? '')
  const data = String(formData.get('data') ?? '')
  const inicio = String(formData.get('inicio') ?? '')
  const servicos = String(formData.get('servicos') ?? '')
  const profissional = String(formData.get('profissional') ?? '')
  if (!id || !unidade || !inicio || !servicos) return

  const appointment = await getAppointment(id)
  if (!appointment) throw new Error('atendimento não encontrado')
  await assertUnidade(appointment.unitId)

  /* Remarcação muda a hora, não o endereço. Um destino diferente da unidade de
     origem não é caso de uso — é campo adulterado. */
  const destino = await getUnitBySlug(unidade)
  if (!destino || destino.id !== appointment.unitId) throw new Error('unidade inválida')

  /* A cliente é a do atendimento que se está a mover, lida do banco. Vinha do
     formulário, e `rescheduleAppointment` reserva com quem lhe passarem: um
     campo trocado remarcava a hora em nome de outra pessoa — a marcação saía do
     histórico de quem a fez e aparecia no de quem nunca lá esteve, com o nome
     errado a chegar à porta no dia. Remarcar muda a hora, não a cliente. */
  const result = await rescheduleAppointment(id, {
    unitSlug: unidade,
    clientId: appointment.clientId,
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

  /* `replace`, nos dois destinos: o formulário de remarcar já foi enviado, e
     deixá-lo no histórico é pôr o botão de voltar a apontar para um envio que
     não se pode repetir. */
  if (!result.ok) {
    redirect(
      `/agenda/${unidade}/remarcar/${id}?d=${data}&erro=${encodeURIComponent(result.message)}`,
      RedirectType.replace,
    )
  }

  revalidatePath('/agenda/[unidade]', 'page')
  redirect(`/agenda/${unidade}?d=${data}&sel=${result.appointmentId}`, RedirectType.replace)
}
