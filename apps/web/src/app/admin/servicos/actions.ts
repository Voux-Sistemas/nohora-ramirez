'use server'

import { revalidatePath } from 'next/cache'
import { createCategory } from '@/server/admin/services'
import { assertRede } from '@/server/auth/permissoes'

/* Categoria organiza o catálogo, e o catálogo é da rede: só a dona. */
export async function criarCategoria(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await assertRede()
  await createCategory(name)
  revalidatePath('/admin/servicos')
}
