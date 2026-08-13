'use server'

/**
 * O que a cliente pode fazer na própria conta.
 *
 * Diferente da recepção (`server/scheduling/actions.ts`): aqui cada acção
 * confere a sessão E a dona da marcação antes de tocar no banco. Um id numa
 * requisição forjada não pode cancelar a visita de outra pessoa.
 */

import { revalidatePath } from 'next/cache'
import { requireClientSession } from '@/server/auth/session'
import { cancelAppointment } from '@/server/scheduling/book'
import { getAppointment } from '@/server/scheduling/queries'

const CANCELAVEL = new Set(['draft', 'scheduled', 'confirmed', 'checked_in'])

export interface EstadoCancelamento {
  erro?: string
}

export async function cancelarMinhaMarcacao(
  _estado: EstadoCancelamento,
  formData: FormData,
): Promise<EstadoCancelamento> {
  const sessao = await requireClientSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { erro: 'Marcação não encontrada.' }

  const marcacao = await getAppointment(id)
  /*
    A mesma frase para "não existe" e para "não é sua": responder coisas
    diferentes confirmaria a existência de uma marcação alheia a quem estivesse
    a testar ids.
  */
  if (!marcacao || marcacao.clientId !== sessao.clientId) {
    return { erro: 'Marcação não encontrada.' }
  }
  if (!CANCELAVEL.has(marcacao.status)) {
    return { erro: 'Esta marcação já não pode ser cancelada. Ligue para a recepção.' }
  }

  await cancelAppointment(id, 'cancelled_by_client', { reason: 'Cancelada pela cliente' })
  revalidatePath('/minha-conta')
  return {}
}
