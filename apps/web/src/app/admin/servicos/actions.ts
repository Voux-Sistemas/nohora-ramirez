'use server'

import { revalidatePath } from 'next/cache'
import { createCategory } from '@/server/admin/services'

export async function criarCategoria(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await createCategory(name)
  revalidatePath('/admin/servicos')
}
