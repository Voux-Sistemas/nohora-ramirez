'use server'

import { revalidatePath } from 'next/cache'
import { type EstadoDeFormulario } from '@/components/ui/erro-do-form'
import {
  createResource,
  createResourceType,
  unitOfResource,
  updateResource,
} from '@/server/admin/resources'
import { assertSuporte, assertUnidade } from '@/server/auth/permissoes'
import { mensagemDoErro } from '@/server/erros'

/**
 * Cadastro de recursos. Nenhuma das três ações conferia nada — com o id de um
 * recurso, sem sessão, dava para desativar a cabine de qualquer loja e derrubar
 * a agenda do dia.
 *
 * O tipo é vocabulário da instalação: inventar "cabine" muda as três lojas e
 * passa a aparecer em todo serviço, e tipo criado errado fica para sempre
 * porque não existe tela de apagar. Por isso ele é do suporte. A instância —
 * "compramos mais uma cadeira" — continua sendo do dia a dia da loja, e a
 * unidade que vale é sempre a lida do banco, não a do formulário.
 */

export async function criarTipoRecurso(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Dê um nome ao tipo de recurso.' }

  try {
    await assertSuporte()
    await createResourceType(name)
  } catch (e) {
    return { error: mensagemDoErro(e, 'não foi possível criar este tipo') }
  }

  revalidatePath('/admin/recursos')
  return { success: true }
}

export async function criarRecurso(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const name = String(formData.get('name') ?? '').trim()
  const unitId = String(formData.get('unitId') ?? '')
  const resourceTypeId = String(formData.get('resourceTypeId') ?? '')
  const priority = Number(formData.get('priority') ?? 0)
  /* As três recusas eram um `return` mudo, e a escolha de loja e de tipo abre
     em branco: quem carregava em "+ adicionar" sem as escolher via a linha não
     aparecer e não sabia porquê. */
  if (!name) return { error: 'Dê um nome ao recurso — "Cabine 1", por exemplo.' }
  if (!unitId) return { error: 'Escolha a loja onde este recurso fica.' }
  if (!resourceTypeId) return { error: 'Escolha o tipo do recurso.' }

  try {
    await assertUnidade(unitId)
    await createResource({ name, unitId, resourceTypeId, active: true, priority })
  } catch (e) {
    return { error: mensagemDoErro(e, 'não foi possível criar este recurso') }
  }

  revalidatePath('/admin/recursos')
  return { success: true }
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
