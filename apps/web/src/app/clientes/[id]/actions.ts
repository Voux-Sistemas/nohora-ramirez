'use server'

import { revalidatePath } from 'next/cache'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { assertGestao } from '@/server/auth/permissoes'
import {
  addClientNote,
  removeClientNote,
  toggleClientNotePin,
  updateClientProfile,
  type ClientProfileInput,
} from '@/server/people/clients'

/**
 * A ficha da cliente é da gestão — a mesma regra da tela, repetida aqui porque
 * a tela esconde e a ação é que decide. A carteira é da rede, não de uma loja:
 * a cliente que faz escova no Centro e coloração no Jardins é uma pessoa só, e
 * recortar a ficha por unidade partiria o histórico dela em dois.
 */

export interface ClienteState {
  error?: string
}

export async function atualizarCliente(
  _state: ClienteState,
  formData: FormData,
): Promise<ClienteState> {
  const clientId = String(formData.get('clientId') ?? '')
  if (!clientId) return { error: 'Ficha não identificada. Recarregue a página.' }
  await assertGestao()

  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Preencha o nome.' }

  /*
    O telefone entra normalizado ou não entra. É a coluna por onde a cliente
    faz login e por onde `findOrCreateClient` a reencontra na próxima marcação:
    gravar `934 730 344` onde o resto do sistema guarda `+351934730344` não dá
    erro nenhum na hora — só parte o login dela e cria uma segunda ficha na
    marcação seguinte, semanas depois, sem ninguém ligar uma coisa à outra.
  */
  const phone = toE164(String(formData.get('phone') ?? ''))
  if (!phone) return { error: telefoneInvalidoErro() }

  const input: ClientProfileInput = {
    name,
    phone,
    email: String(formData.get('email') ?? '').trim() || undefined,
    birthdate: String(formData.get('birthdate') ?? '').trim() || undefined,
    document: String(formData.get('document') ?? '').trim() || undefined,
    howFoundUs: String(formData.get('howFoundUs') ?? '').trim() || undefined,
    preferredUnitId: String(formData.get('preferredUnitId') ?? '').trim() || undefined,
    preferredStaffId: String(formData.get('preferredStaffId') ?? '').trim() || undefined,
    tags,
    requiresDeposit: formData.get('requiresDeposit') === 'on',
  }

  await updateClientProfile(clientId, input)
  revalidatePath(`/clientes/${clientId}`)
  return {}
}

export async function adicionarNota(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!clientId || !body) return
  await assertGestao()
  await addClientNote(clientId, body, formData.get('pinned') === 'on')
  revalidatePath(`/clientes/${clientId}`)
}

export async function alternarFixarNota(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  const noteId = String(formData.get('noteId') ?? '')
  if (!noteId) return
  await assertGestao()
  await toggleClientNotePin(noteId)
  revalidatePath(`/clientes/${clientId}`)
}

export async function removerNota(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  const noteId = String(formData.get('noteId') ?? '')
  if (!noteId) return
  await assertGestao()
  await removeClientNote(noteId)
  revalidatePath(`/clientes/${clientId}`)
}
