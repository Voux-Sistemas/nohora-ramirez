'use server'

import { revalidatePath } from 'next/cache'
import { assertUnidade } from '@/server/auth/permissoes'
import { addMovement, closeSession, openSession, unitOfSession } from '@/server/finance/caixa'

/**
 * Abrir, fechar e sangrar o caixa.
 *
 * Nenhuma das três conferia nada: com o id de uma sessão, sem sessão de login,
 * dava para lançar uma retirada na gaveta de qualquer loja. A permissão é
 * sempre sobre a unidade lida do banco — `unitId` e `sessionId` chegam pelo
 * formulário e não valem como prova de nada.
 */

export async function abrirCaixa(formData: FormData): Promise<void> {
  const unitId = String(formData.get('unitId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const openingAmount = Math.round(Number(formData.get('openingAmount') ?? 0) * 100)
  if (!unitId) return

  await assertUnidade(unitId)
  await openSession(unitId, openingAmount)
  revalidatePath(`/caixa/${unitSlug}`)
}

export async function fecharCaixa(formData: FormData): Promise<void> {
  const sessionId = String(formData.get('sessionId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const closingCountedAmount = Math.round(Number(formData.get('closingCountedAmount') ?? 0) * 100)
  if (!sessionId) return

  await autorizarSessao(sessionId)
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

  await autorizarSessao(sessionId)
  await addMovement(sessionId, type, amount, note || undefined)
  revalidatePath(`/caixa/${unitSlug}`)
}

async function autorizarSessao(sessionId: string): Promise<void> {
  const unitId = await unitOfSession(sessionId)
  if (!unitId) throw new Error('caixa não encontrado')
  await assertUnidade(unitId)
}
