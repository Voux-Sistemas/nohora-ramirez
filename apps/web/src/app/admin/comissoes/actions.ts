'use server'

import { revalidatePath } from 'next/cache'
import {
  markCommissionsPaid,
  removeCommissionRule,
  upsertCommissionRule,
} from '@/server/finance/commissions'

export async function salvarRegra(formData: FormData): Promise<void> {
  const staffId = String(formData.get('staffId') ?? '').trim()
  const serviceId = String(formData.get('serviceId') ?? '').trim()
  const percent = Number(formData.get('percent') ?? 0)
  if (!percent || percent <= 0) return

  await upsertCommissionRule({
    staffId: staffId || undefined,
    serviceId: serviceId || undefined,
    percentBps: Math.round(percent * 100),
  })
  revalidatePath('/admin/comissoes')
}

export async function excluirRegra(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await removeCommissionRule(id)
  revalidatePath('/admin/comissoes')
}

export async function pagarComissoes(formData: FormData): Promise<void> {
  const staffId = String(formData.get('staffId') ?? '')
  if (!staffId) return
  await markCommissionsPaid(staffId)
  revalidatePath('/admin/comissoes')
}
