'use server'

/**
 * Ações da cliente logada. Diferente da recepção (@/server/scheduling/actions),
 * aqui a cliente só pode mexer no próprio agendamento — cada ação confere a
 * sessão antes de tocar no banco.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cancelAppointment } from '@/server/scheduling/book'
import { getAppointment } from '@/server/scheduling/queries'
import { updateContaIdentidade } from '@/server/people/clients'
import { requireClientSession } from '@/server/auth/session'

const CANCELABLE = new Set(['draft', 'scheduled', 'confirmed', 'checked_in'])

export interface CancelState {
  error?: string
}

export async function cancelarMeuAgendamento(
  _state: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const session = await requireClientSession()
  const id = String(formData.get('id') ?? '')
  if (!id) return { error: 'Marcação não encontrada.' }

  const appointment = await getAppointment(id)
  if (!appointment || appointment.clientId !== session.clientId) {
    return { error: 'Marcação não encontrada.' }
  }
  if (!CANCELABLE.has(appointment.status)) {
    return { error: 'Esta marcação já não pode ser cancelada.' }
  }

  await cancelAppointment(id, 'cancelled_by_client', { reason: 'Cancelado pela cliente' })
  revalidatePath('/conta')
  return {}
}

export interface PerfilState {
  error?: string
  ok?: boolean
}

const perfilSchema = z.object({
  nome: z.string().trim().min(2, 'Diga o seu nome completo.').max(120),
  // Mesma razão de `agendar/.../confirmar`: campo opcional chega como string
  // vazia, não ausente. Apagar o e-mail é uma escolha legítima da cliente, e
  // recusar o formulário por causa disso seria trancá-la no que já lá estava.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(180)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido.'),
})

/**
 * A cliente a corrigir a própria ficha.
 *
 * Quem é ela vem da **sessão**, nunca do formulário: um `userId` num campo
 * escondido seria um convite a trocar o número e editar a ficha de outra
 * pessoa. Por isso não há identificador nenhum aqui — a chave é o cookie.
 *
 * Apagar o e-mail é permitido e tem consequência: sem e-mail na ficha, o código
 * de acesso não tem para onde ir e a próxima entrada passa pela receção. O
 * formulário avisa; a decisão é dela.
 */
export async function atualizarPerfil(
  _state: PerfilState,
  formData: FormData,
): Promise<PerfilState> {
  const session = await requireClientSession()

  const parsed = perfilSchema.safeParse({
    nome: formData.get('nome') ?? '',
    email: formData.get('email') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Reveja os campos.' }
  }

  await updateContaIdentidade(session.userId, {
    name: parsed.data.nome,
    email: parsed.data.email || null,
  })

  revalidatePath('/conta')
  return { ok: true }
}
