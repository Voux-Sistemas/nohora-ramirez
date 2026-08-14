'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { findOrCreateClient } from '@/server/people/clients'
import { createAppointment } from '@/server/scheduling/book'
import { getUnitBySlug } from '@/server/scheduling/context'
import { checkBookingQuota } from '@/server/security/booking-guard'
import { RULES, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

const schema = z.object({
  unidade: z.string().min(1),
  servicos: z.string().min(1),
  inicio: z.string().min(1),
  profissional: z.string().optional(),
  nome: z.string().trim().min(2, 'Diga o seu nome completo.'),
  telefone: z.string().trim().min(10, 'Telefone incompleto.'),
  // Campo opcional chega como string vazia, não como ausente — então "vazio" é
  // um valor válido aqui, e não uma exceção. Validar direto com `.email()`
  // recusaria o formulário inteiro por causa de um campo que a cliente tinha o
  // direito de não preencher (inclusive se ela só encostou na barra de espaço).
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido.')
    .optional(),
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
  // O freio de IP vem antes do zod: recusar cedo custa quase nada, e é o ponto
  // em que a enxurrada para de encostar no banco.
  const ip = await clientIp()
  const volume = hit(`agendar:${ip}`, RULES.agendamento)
  if (!volume.ok) {
    // O tempo exato vem do próprio freio: número redondo inventado vira mentira
    // no primeiro teste de quem lê a tela e conta.
    const minutos = Math.ceil(volume.retryAfterSec / 60)
    return {
      error: `Muitas tentativas seguidas. Tente de novo em ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} ou fale com a receção.`,
    }
  }

  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Confira os dados.' }
  }
  const data = parsed.data

  const phone = toE164(data.telefone)
  if (!phone) return { error: telefoneInvalidoErro() }

  const unit = await getUnitBySlug(data.unidade)
  if (!unit) return { error: 'Unidade não encontrada.' }

  const client = await findOrCreateClient({
    phone,
    name: data.nome,
    ...(data.email ? { email: data.email } : {}),
    preferredUnitId: unit.id,
  })

  // Depois de saber quem é: a cota por telefone, que o banco guarda e nenhum
  // reinício apaga.
  const cota = await checkBookingQuota(client.clientId)
  if (!cota.ok) return { error: cota.message ?? 'Não foi possível marcar agora.' }

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

  // O primeiro nome viaja no endereço porque o selo cumprimenta por ele — e o
  // que ela escreveu agora é a única versão que lhe pertence. `findOrCreateClient`
  // reconhece a cliente pelo telemóvel e devolve o nome que já estava gravado:
  // ler daí seria contar, a quem digitou um número, como se chama quem o tem.
  const primeiroNome = data.nome.split(/\s+/)[0] ?? ''
  redirect(
    `/agendar/${data.unidade}/pronto/${result.appointmentId}?para=${encodeURIComponent(primeiroNome)}`,
  )
}
