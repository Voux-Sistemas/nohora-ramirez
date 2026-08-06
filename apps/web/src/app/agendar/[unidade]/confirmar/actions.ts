'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { toE164 } from '@/lib/format'
import { findOrCreateClient } from '@/server/people/clients'
import { createAppointment } from '@/server/scheduling/book'
import { getUnitBySlug } from '@/server/scheduling/context'

const schema = z.object({
  unidade: z.string().min(1),
  servicos: z.string().min(1),
  inicio: z.string().min(1),
  profissional: z.string().optional(),
  nome: z.string().trim().min(2, 'Diga seu nome completo.'),
  telefone: z.string().trim().min(10, 'Telefone incompleto.'),
  observacao: z.string().trim().max(400).optional(),
})

export interface ConfirmState {
  error?: string
}

/**
 * Confirmação do agendamento pelo app da cliente.
 *
 * O formulário manda o INSTANTE e o carrinho — nunca os blocos. Quem replaneja
 * e grava é `createAppointment`, que também é quem traduz a colisão do banco em
 * "esse horário acabou de ser ocupado".
 */
export async function confirmarAgendamento(
  _state: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Confira os dados.' }
  }
  const data = parsed.data

  const phone = toE164(data.telefone)
  if (!phone) return { error: 'Telefone inválido. Use DDD + número.' }

  const unit = await getUnitBySlug(data.unidade)
  if (!unit) return { error: 'Unidade não encontrada.' }

  const client = await findOrCreateClient({
    phone,
    name: data.nome,
    preferredUnitId: unit.id,
  })

  const result = await createAppointment({
    unitSlug: data.unidade,
    clientId: client.clientId,
    cart: data.servicos.split(',').filter(Boolean).map((serviceId) => ({
      serviceId,
      ...(data.profissional ? { staffId: data.profissional } : {}),
    })),
    start: data.inicio,
    source: 'client_app',
    channel: 'online',
    ...(data.observacao ? { clientNote: data.observacao } : {}),
  })

  if (!result.ok) return { error: result.message }

  redirect(`/agendar/${data.unidade}/pronto/${result.appointmentId}`)
}
