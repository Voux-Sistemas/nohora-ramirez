'use server'

import { revalidatePath } from 'next/cache'
import { closeComanda, type ClosePaymentInput, type PaymentMethod } from '@/server/finance/comanda'

const METHODS = new Set<PaymentMethod>(['cash', 'debit_card', 'credit_card', 'pix', 'other'])

export async function fecharComanda(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get('appointmentId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  if (!appointmentId) return

  const discountAmount = Math.round(Number(formData.get('discountAmount') ?? 0) * 100)
  const discountReason = String(formData.get('discountReason') ?? '').trim()

  const paymentsInput: ClosePaymentInput[] = []
  for (let i = 1; i <= 3; i++) {
    const method = String(formData.get(`p${i}_method`) ?? '')
    const amount = Math.round(Number(formData.get(`p${i}_amount`) ?? 0) * 100)
    if (amount > 0 && METHODS.has(method as PaymentMethod)) {
      paymentsInput.push({ method: method as PaymentMethod, amount })
    }
  }

  await closeComanda(appointmentId, {
    discountAmount,
    discountReason: discountReason || undefined,
    payments: paymentsInput,
  })

  revalidatePath(`/agenda/${unitSlug}/comanda/${appointmentId}`)
  revalidatePath('/agenda/[unidade]', 'page')
}
