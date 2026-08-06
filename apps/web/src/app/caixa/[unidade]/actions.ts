'use server'

import { revalidatePath } from 'next/cache'
import { addMovement, closeSession, openSession } from '@/server/finance/caixa'

export async function abrirCaixa(formData: FormData): Promise<void> {
  const unitId = String(formData.get('unitId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const openingAmount = Math.round(Number(formData.get('openingAmount') ?? 0) * 100)
  if (!unitId) return

  await openSession(unitId, openingAmount)
  revalidatePath(`/caixa/${unitSlug}`)
}

export async function fecharCaixa(formData: FormData): Promise<void> {
  const sessionId = String(formData.get('sessionId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const closingCountedAmount = Math.round(Number(formData.get('closingCountedAmount') ?? 0) * 100)
  if (!sessionId) return

  await closeSession(sessionId, closingCountedAmount)
  revalidatePath(`/caixa/${unitSlug}`)
}

export async function lancarMovimento(formData: FormData): Promise<void> {
  const sessionId = String(formData.get('sessionId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const type = String(formData.get('type') ?? '')
  const amount = Math.round(Number(formData.get('amount') ?? 0) * 100)
  const note = String(formData.get('note') ?? '').trim()
  if (!sessionId || (type !== 'reinforcement' && type !== 'withdrawal')) return

  await addMovement(sessionId, type, amount, note || undefined)
  revalidatePath(`/caixa/${unitSlug}`)
}
