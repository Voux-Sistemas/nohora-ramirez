'use server'

import { revalidatePath } from 'next/cache'
import { type EstadoDeFormulario } from '@/components/ui/erro-do-form'
import { formatMoney } from '@/lib/format'
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

/**
 * O valor confirmado viaja no formulário e é conferido lá dentro — pagar é o
 * único ato desta tela que não tem volta, e o número que a dona leu tem de ser
 * o número que o sistema liquida.
 */
export async function pagarComissoes(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const staffId = String(formData.get('staffId') ?? '')
  const esperado = Number(formData.get('esperado') ?? '')
  if (!staffId || !Number.isInteger(esperado)) return {}

  try {
    await assertRede()
    const resultado = await markCommissionsPaid(staffId, esperado)
    revalidatePath('/admin/comissoes')
    if ('divergiu' in resultado) {
      return {
        error: `O pendente mudou desde que este ecrã abriu — agora são ${formatMoney(resultado.divergiu)}. Não foi pago nada; confira o valor e confirme outra vez.`,
      }
    }
  } catch (e) {
    return { error: mensagemDoErro(e, 'não foi possível registar este pagamento') }
  }

  return { success: true }
}
