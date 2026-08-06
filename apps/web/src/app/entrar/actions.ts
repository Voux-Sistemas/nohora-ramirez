'use server'

import { redirect } from 'next/navigation'
import { toE164 } from '@/lib/format'
import { verifyStaffLogin } from '@/server/auth/password'

export interface LoginState {
  error?: string
}

/** Só aceita caminho interno — evita redirecionar para fora depois do login. */
function safeNext(next: string): string {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
}

/** Atalho de teste: "equipe" entra como a dona da conta demo, sem precisar de telefone real. */
const TEST_ALIASES: Record<string, string> = {
  equipe: '+5511980000001',
}

export async function entrarComoEquipe(_state: LoginState, formData: FormData): Promise<LoginState> {
  const raw = String(formData.get('telefone') ?? '').trim().toLowerCase()
  const phone = TEST_ALIASES[raw] ?? toE164(raw)
  const senha = String(formData.get('senha') ?? '')
  const next = safeNext(String(formData.get('next') ?? ''))
  if (!phone) return { error: 'Telefone inválido.' }
  if (!senha) return { error: 'Digite a senha.' }

  const result = await verifyStaffLogin(phone, senha)
  if (!result.ok) return { error: result.message }

  redirect(next as never)
}
