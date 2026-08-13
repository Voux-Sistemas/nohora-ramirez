'use server'

import { revalidatePath } from 'next/cache'
import { assertUnidade } from '@/server/auth/permissoes'
import {
  closeComanda,
  getComanda,
  type ClosePaymentInput,
  type PaymentMethod,
} from '@/server/finance/comanda'

const METHODS = new Set<PaymentMethod>(['cash', 'debit_card', 'credit_card', 'pix', 'other'])

/**
 * Fechar comanda grava pagamento, desconto e comissão. Não tinha porteiro
 * nenhum: com o id do atendimento na mão, sem sessão, dava para lançar um
 * "pago em dinheiro" no caixa da loja. A unidade que manda é a do atendimento,
 * lida do banco — `unitSlug` no formulário serve só para revalidar a tela.
 */
export async function fecharComanda(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get('appointmentId') ?? '')
  
  if (!appointmentId) return

  const comanda = await getComanda(appointmentId)
  if (!comanda) throw new Error('atendimento não encontrado')
  await assertUnidade(comanda.unitId)

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

  revalidatePath(`/painel/atendimento/${appointmentId}`)
  revalidatePath('/painel', 'page')
}
