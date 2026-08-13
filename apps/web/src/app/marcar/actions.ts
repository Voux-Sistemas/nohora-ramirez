'use server'

/**
 * O que a tela de marcação pede ao servidor.
 *
 * Só invólucros: a lógica vive em `server/scheduling/marcacao.ts`, e as regras
 * de agenda no motor. Aqui ficam a autorização, os freios e a tradução de erro
 * para uma frase que a cliente entenda.
 *
 * Um arquivo `'use server'` só pode exportar funções assíncronas — os tipos
 * destas respostas moram em `lib/marcacao-tipos.ts`.
 */

import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { DiaLivre, ProfissionalEscolhivel, ServicoEscolhivel } from '@/lib/marcacao-tipos'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { getSession } from '@/server/auth/session'
import { findOrCreateClient } from '@/server/people/clients'
import { createAppointment } from '@/server/scheduling/book'
import { getUnitBySlug } from '@/server/scheduling/context'
import {
  catalogoDaCasa,
  diasComHorarios,
  profissionaisPara,
} from '@/server/scheduling/marcacao'
import { checkBookingQuota } from '@/server/security/booking-guard'
import { RULES, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

export async function carregarCatalogo(slug: string): Promise<ServicoEscolhivel[]> {
  return catalogoDaCasa(slug)
}

export async function carregarProfissionais(
  slug: string,
  servicoIds: string[],
): Promise<ProfissionalEscolhivel[]> {
  return profissionaisPara(slug, servicoIds)
}

export async function carregarDias(
  slug: string,
  servicoIds: string[],
  staffId: string | null,
  /** `null` = a partir de hoje na casa; o navegador não sabe que dia é lá. */
  deData: string | null,
): Promise<DiaLivre[]> {
  return diasComHorarios(slug, servicoIds, staffId, deData)
}

const schema = z.object({
  casa: z.string().min(1),
  servicos: z.string().min(1),
  inicio: z.string().min(1),
  profissional: z.string().optional(),
  nome: z.string().trim().min(2, 'Diga o seu nome completo.'),
  telefone: z.string().trim().min(6, 'Telemóvel incompleto.'),
  /* Campo opcional chega como string vazia, não como ausente — então "vazio" é
     um valor válido aqui, e não uma excepção. Validar direto com `.email()`
     recusaria o formulário inteiro por causa de um campo que a cliente tinha o
     direito de não preencher. */
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'E-mail inválido.')
    .optional(),
  observacao: z.string().trim().max(400).optional(),
})

export interface EstadoConfirmacao {
  erro?: string
}

/**
 * Fecha a marcação.
 *
 * O formulário manda o INSTANTE e o carrinho — nunca os blocos. Quem replaneja
 * quem faz o quê, em que cadeira, e quem traduz a colisão do banco em "este
 * horário acabou de ser ocupado" é `createAppointment`.
 */
export async function confirmarMarcacao(
  _estado: EstadoConfirmacao,
  formData: FormData,
): Promise<EstadoConfirmacao> {
  /* O freio de IP vem antes do zod: recusar cedo custa quase nada, e é o ponto
     em que a enxurrada deixa de encostar no banco. */
  const ip = await clientIp()
  const volume = hit(`marcar:${ip}`, RULES.agendamento)
  if (!volume.ok) {
    const minutos = Math.ceil(volume.retryAfterSec / 60)
    return {
      erro: `Muitas tentativas seguidas. Tente daqui a ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} ou ligue para a recepção.`,
    }
  }

  const analisado = schema.safeParse(Object.fromEntries(formData))
  if (!analisado.success) {
    return { erro: analisado.error.issues[0]?.message ?? 'Confira os dados.' }
  }
  const dados = analisado.data

  const telefone = toE164(dados.telefone)
  if (!telefone) return { erro: telefoneInvalidoErro() }

  const unidade = await getUnitBySlug(dados.casa)
  if (!unidade) return { erro: 'Casa não encontrada.' }

  /*
    Quem já entrou marca na própria ficha, mesmo que tenha escrito outro
    telemóvel no formulário. Sem isto, uma cliente com sessão aberta que
    corrigisse um dígito criava uma segunda ficha e perdia o histórico —
    e a recepção passava a ter duas "Camila Ferreira".
  */
  const sessao = await getSession()
  const cliente = sessao?.clientId
    ? { clientId: sessao.clientId }
    : await findOrCreateClient({
        phone: telefone,
        name: dados.nome,
        ...(dados.email ? { email: dados.email } : {}),
        preferredUnitId: unidade.id,
      })

  // Depois de saber quem é: a cota por ficha, que o banco guarda e nenhum
  // reinício apaga.
  const cota = await checkBookingQuota(cliente.clientId)
  if (!cota.ok) return { erro: cota.message ?? 'Não foi possível marcar agora.' }

  const resultado = await createAppointment({
    unitSlug: dados.casa,
    clientId: cliente.clientId,
    cart: dados.servicos
      .split(',')
      .filter(Boolean)
      .map((serviceId) => ({
        serviceId,
        ...(dados.profissional ? { staffId: dados.profissional } : {}),
      })),
    start: dados.inicio,
    source: 'client_app',
    channel: 'online',
    ...(dados.observacao ? { clientNote: dados.observacao } : {}),
  })

  if (!resultado.ok) return { erro: resultado.message }

  redirect(`/marcar/pronto/${resultado.appointmentId}`)
}
