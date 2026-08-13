'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { assertUnidade } from '@/server/auth/permissoes'
import { findOrCreateClient } from '@/server/people/clients'
import { createAppointment } from '@/server/scheduling/book'
import { getUnitBySlug } from '@/server/scheduling/context'

/**
 * Encaixe pela recepção.
 *
 * Diferente do agendamento do cliente em dois pontos: o canal é `reception`
 * (logo o motor ignora antecedência mínima e serviços fora do catálogo online),
 * e a observação vai para a nota interna, não para a nota da cliente.
 *
 * Esse canal é um atalho pelas regras, e por isso a ação confere quem chama —
 * a tela já é de gestão, mas server action é endereço HTTP: sem porteiro aqui,
 * um formulário forjado marcaria por fora da antecedência em qualquer loja.
 */

const schema = z.object({
  unidade: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  servicos: z.string().min(1),
  inicio: z.string().min(1),
  profissional: z.string().optional(),
  nome: z.string().trim().min(2, 'Diga o nome da cliente.'),
  telefone: z.string().trim().min(8, 'Telefone incompleto.'),
  observacao: z.string().trim().max(500).optional(),
})

export interface EncaixeState {
  error?: string
}

export async function criarEncaixe(
  _state: EncaixeState,
  formData: FormData,
): Promise<EncaixeState> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Confira os dados.' }
  }
  const input = parsed.data

  const phone = toE164(input.telefone)
  if (!phone) return { error: telefoneInvalidoErro() }

  const unit = await getUnitBySlug(input.unidade)
  if (!unit) return { error: 'Unidade não encontrada.' }
  await assertUnidade(unit.id)

  const client = await findOrCreateClient({
    phone,
    name: input.nome,
    preferredUnitId: unit.id,
  })

  const serviceIds = input.servicos.split(',').filter(Boolean)
  const result = await createAppointment({
    unitSlug: input.unidade,
    clientId: client.clientId,
    cart: serviceIds.map((serviceId) => ({
      serviceId,
      ...(input.profissional ? { staffId: input.profissional } : {}),
    })),
    start: input.inicio,
    source: 'reception',
    channel: 'reception',
    ...(input.observacao ? { internalNote: input.observacao } : {}),
  })

  if (!result.ok) return { error: result.message }

  revalidatePath('/agenda/[unidade]', 'page')
  redirect(`/agenda/${input.unidade}?d=${input.data}&sel=${result.appointmentId}`)
}
