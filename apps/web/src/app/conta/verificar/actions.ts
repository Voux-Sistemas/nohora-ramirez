'use server'

import { redirect } from 'next/navigation'
import { dicionario } from '@/i18n'
import { lerIdioma } from '@/lib/idioma'
import { verifyOtp } from '@/server/auth/otp'

export interface CodeState {
  error?: string
}

export async function confirmarCodigo(_state: CodeState, formData: FormData): Promise<CodeState> {
  const erros = dicionario(await lerIdioma()).conta.erros
  const phone = String(formData.get('telefone') ?? '')
  const codigo = String(formData.get('codigo') ?? '').trim()
  if (!phone) return { error: erros.telefoneEmFalta }
  if (!codigo) return { error: erros.codigoEmFalta }

  const result = await verifyOtp(phone, codigo)
  if (!result.ok) return { error: erros.codigo[result.motivo] }

  redirect('/conta')
}
