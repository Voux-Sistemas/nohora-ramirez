'use server'

import { revalidatePath } from 'next/cache'
import { createResource, createResourceType, updateResource } from '@/server/admin/resources'

export async function criarTipoRecurso(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await createResourceType(name)
  revalidatePath('/admin/recursos')
}

export async function criarRecurso(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  const unitId = String(formData.get('unitId') ?? '')
  const resourceTypeId = String(formData.get('resourceTypeId') ?? '')
  const priority = Number(formData.get('priority') ?? 0)
  if (!name || !unitId || !resourceTypeId) return
  await createResource({ name, unitId, resourceTypeId, active: true, priority })
  revalidatePath('/admin/recursos')
}

export async function alternarRecurso(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '')
  const unitId = String(formData.get('unitId') ?? '')
  const resourceTypeId = String(formData.get('resourceTypeId') ?? '')
  const priority = Number(formData.get('priority') ?? 0)
  const active = String(formData.get('active') ?? '') === 'true'
  if (!id) return
  await updateResource(id, { name, unitId, resourceTypeId, priority, active: !active })
  revalidatePath('/admin/recursos')
}
