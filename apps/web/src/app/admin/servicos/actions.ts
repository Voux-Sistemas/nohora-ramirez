'use server'

import { revalidatePath } from 'next/cache'
import { type EstadoDeFormulario } from '@/components/ui/erro-do-form'
import { createCategory } from '@/server/admin/services'
import { assertRede } from '@/server/auth/permissoes'
import { mensagemDoErro } from '@/server/erros'

/* Categoria organiza o catálogo, e o catálogo é da rede: só a dona. */
export async function criarCategoria(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Dê um nome à categoria.' }

  try {
    await assertRede()
    await createCategory(name)
  } catch (e) {
    return { error: mensagemDoErro(e, 'não foi possível criar esta categoria') }
  }

  revalidatePath('/admin/servicos')
  return { success: true }
}
