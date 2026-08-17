'use server'

import { revalidatePath } from 'next/cache'
import { type EstadoDeFormulario } from '@/components/ui/erro-do-form'
import { assertRede } from '@/server/auth/permissoes'
import { mensagemDoErro } from '@/server/erros'
import {
  markCommissionsPaid,
  removeCommissionRule,
  upsertCommissionRule,
} from '@/server/finance/commissions'

/* Comissão é acerto da dona com cada profissional — as três ações são da rede. */

export async function salvarRegra(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const staffId = String(formData.get('staffId') ?? '').trim()
  const serviceId = String(formData.get('serviceId') ?? '').trim()
  const percent = Number(formData.get('percent') ?? 0)
  /* Era `return` mudo: a dona escrevia a regra, carregava em Guardar, e a lista
     acima continuava igual sem nada explicar. */
  if (!Number.isFinite(percent) || percent <= 0) {
    return { error: 'Escreva a percentagem da comissão — acima de zero.' }
  }
  if (percent > 100) {
    return { error: 'A comissão não pode passar de 100% do serviço.' }
  }

  try {
    await assertRede()
    await upsertCommissionRule({
      staffId: staffId || undefined,
      serviceId: serviceId || undefined,
      percentBps: Math.round(percent * 100),
    })
  } catch (e) {
    return { error: mensagemDoErro(e, 'não foi possível guardar esta regra') }
  }

  revalidatePath('/admin/comissoes')
  return { success: true }
}

export async function excluirRegra(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await assertRede()
  await removeCommissionRule(id)
  revalidatePath('/admin/comissoes')
}

export async function pagarComissoes(formData: FormData): Promise<void> {
  const staffId = String(formData.get('staffId') ?? '')
  if (!staffId) return
  await assertRede()
  await markCommissionsPaid(staffId)
  revalidatePath('/admin/comissoes')
}
