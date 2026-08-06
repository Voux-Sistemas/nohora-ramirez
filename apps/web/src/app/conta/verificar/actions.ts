'use server'

import { redirect } from 'next/navigation'
import { verifyOtp } from '@/server/auth/otp'

export interface CodeState {
  error?: string
}

export async function confirmarCodigo(_state: CodeState, formData: FormData): Promise<CodeState> {
  const phone = String(formData.get('telefone') ?? '')
  const codigo = String(formData.get('codigo') ?? '').trim()
  if (!phone) return { error: 'Telefone não informado.' }
  if (!codigo) return { error: 'Digite o código recebido.' }

  const result = await verifyOtp(phone, codigo)
  if (!result.ok) return { error: result.message }

  redirect('/conta')
}
