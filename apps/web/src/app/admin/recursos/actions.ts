'use server'

import { revalidatePath } from 'next/cache'
import {
  createResource,
  createResourceType,
  unitOfResource,
  updateResource,
} from '@/server/admin/resources'
import { assertRede, assertUnidade } from '@/server/auth/permissoes'

/**
 * Cadastro de recursos. Nenhuma das três ações conferia nada — com o id de um
 * recurso, sem sessão, dava para desativar a cabine de qualquer loja e derrubar
 * a agenda do dia.
 *
 * O tipo é da rede (criar "cabine" muda as três lojas); a instância mora numa
 * unidade, e a unidade que vale é sempre a lida do banco, não a do formulário.
 */

export async function criarTipoRecurso(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  await assertRede()
  await createResourceType(name)
  revalidatePath('/admin/recursos')
}

export async function criarRecurso(formData: FormData): Promise<void> {
  const name = String(formData.get('name') ?? '').trim()
  const unitId = String(formData.get('unitId') ?? '')
  const resourceTypeId = String(formData.get('resourceTypeId') ?? '')
  const priority = Number(formData.get('priority') ?? 0)
  if (!name || !unitId || !resourceTypeId) return
  await assertUnidade(unitId)
  await createResource({ name, unitId, resourceTypeId, active: true, priority })
  revalidatePath('/admin/recursos')
}

export async function alternarRecurso(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '')
  const resourceTypeId = String(formData.get('resourceTypeId') ?? '')
  const priority = Number(formData.get('priority') ?? 0)
  const active = String(formData.get('active') ?? '') === 'true'
  if (!id) return

  /* A unidade vem do banco e não do campo escondido: assim o botão de ligar e
     desligar não vira um jeito de mudar a cabine de loja. */
  const unitId = await unitOfResource(id)
  if (!unitId) throw new Error('recurso não encontrado')
  await assertUnidade(unitId)

  await updateResource(id, { name, unitId, resourceTypeId, priority, active: !active })
  revalidatePath('/admin/recursos')
}
