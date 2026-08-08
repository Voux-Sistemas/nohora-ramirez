'use server'

import { revalidatePath } from 'next/cache'
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

export async function atualizarCliente(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  if (!clientId) return
  await assertGestao()

  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const input: ClientProfileInput = {
    name: String(formData.get('name') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim(),
    email: String(formData.get('email') ?? '').trim() || undefined,
    birthdate: String(formData.get('birthdate') ?? '').trim() || undefined,
    document: String(formData.get('document') ?? '').trim() || undefined,
    howFoundUs: String(formData.get('howFoundUs') ?? '').trim() || undefined,
    preferredUnitId: String(formData.get('preferredUnitId') ?? '').trim() || undefined,
    preferredStaffId: String(formData.get('preferredStaffId') ?? '').trim() || undefined,
    tags,
    requiresDeposit: formData.get('requiresDeposit') === 'on',
  }
  if (!input.name || !input.phone) return

  await updateClientProfile(clientId, input)
  revalidatePath(`/clientes/${clientId}`)
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
