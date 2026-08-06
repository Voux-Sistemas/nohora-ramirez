'use server'

import { redirect } from 'next/navigation'
import { toE164 } from '@/lib/format'
import { loginTestClient, requestOtp } from '@/server/auth/otp'

export interface PhoneState {
  error?: string
}

/** Atalho de teste: "cliente" + senha fixa entra direto, sem esperar código. */
const TEST_ALIASES: Record<string, string> = {
  cliente: '+5511970000001',
}
const TEST_PASSWORD = 'cliente123'

export async function pedirCodigo(_state: PhoneState, formData: FormData): Promise<PhoneState> {
  const raw = String(formData.get('telefone') ?? '').trim().toLowerCase()
  const aliasPhone = TEST_ALIASES[raw]

  if (aliasPhone) {
    const senha = String(formData.get('senha') ?? '')
    if (senha !== TEST_PASSWORD) return { error: 'Senha incorreta.' }
    const result = await loginTestClient(aliasPhone)
    if (!result.ok) return { error: result.message }
    redirect('/conta' as never)
  }

  const phone = toE164(raw)
  if (!phone) return { error: 'Telefone inválido. Use DDD + número.' }

  const result = await requestOtp(phone)
  if (!result.ok) return { error: result.message }

  const params = new URLSearchParams({ telefone: phone })
  if (result.devCode) params.set('dev', result.devCode)
  redirect(`/conta/verificar?${params.toString()}` as never)
}
