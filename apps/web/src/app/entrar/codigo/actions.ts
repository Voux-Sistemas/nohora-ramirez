'use server'

import { redirect } from 'next/navigation'
import { verifyOtp } from '@/server/auth/otp'

export interface EstadoCodigo {
  erro?: string
}

export async function confirmarCodigo(
  _estado: EstadoCodigo,
  formData: FormData,
): Promise<EstadoCodigo> {
  const telefone = String(formData.get('telefone') ?? '')
  const codigo = String(formData.get('codigo') ?? '').trim()
  if (!telefone) return { erro: 'Telemóvel não indicado.' }
  if (!codigo) return { erro: 'Escreva o código que recebeu.' }

  const resultado = await verifyOtp(telefone, codigo)
  if (!resultado.ok) return { erro: resultado.message }

  redirect('/minha-conta')
}
