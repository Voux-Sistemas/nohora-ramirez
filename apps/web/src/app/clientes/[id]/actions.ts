'use server'

import { revalidatePath } from 'next/cache'
import {
  addClientNote,
  removeClientNote,
  toggleClientNotePin,
  updateClientProfile,
  type ClientProfileInput,
} from '@/server/people/clients'

export async function atualizarCliente(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  if (!clientId) return

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
  await addClientNote(clientId, body, formData.get('pinned') === 'on')
  revalidatePath(`/clientes/${clientId}`)
}

export async function alternarFixarNota(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  const noteId = String(formData.get('noteId') ?? '')
  if (!noteId) return
  await toggleClientNotePin(noteId)
  revalidatePath(`/clientes/${clientId}`)
}

export async function removerNota(formData: FormData): Promise<void> {
  const clientId = String(formData.get('clientId') ?? '')
  const noteId = String(formData.get('noteId') ?? '')
  if (!noteId) return
  await removeClientNote(noteId)
  revalidatePath(`/clientes/${clientId}`)
}
