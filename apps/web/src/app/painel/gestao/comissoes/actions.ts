'use server'

import { revalidatePath } from 'next/cache'
import { assertRede } from '@/server/auth/permissoes'
import {
  markCommissionsPaid,
  removeCommissionRule,
  upsertCommissionRule,
} from '@/server/finance/commissions'

/* Comissão é acerto da dona com cada profissional — as três ações são da rede. */

export async function salvarRegra(formData: FormData): Promise<void> {
  const staffId = String(formData.get('staffId') ?? '').trim()
  const serviceId = String(formData.get('serviceId') ?? '').trim()
  const percent = Number(formData.get('percent') ?? 0)
  if (!percent || percent <= 0) return
  await assertRede()

  await upsertCommissionRule({
    staffId: staffId || undefined,
    serviceId: serviceId || undefined,
    percentBps: Math.round(percent * 100),
  })
  revalidatePath('/painel/gestao/comissoes')
}

export async function excluirRegra(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await assertRede()
  await removeCommissionRule(id)
  revalidatePath('/painel/gestao/comissoes')
}

export async function pagarComissoes(formData: FormData): Promise<void> {
  const staffId = String(formData.get('staffId') ?? '')
  if (!staffId) return
  await assertRede()
  await markCommissionsPaid(staffId)
  revalidatePath('/painel/gestao/comissoes')
}
