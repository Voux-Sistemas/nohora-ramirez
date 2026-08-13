import 'server-only'

/**
 * O que a tela de marcação precisa saber, no formato em que precisa.
 *
 * ── Por que isto existe ───────────────────────────────────────────────────
 * A marcação era um caminho de quatro páginas — `/agendar`, `/agendar/[casa]`,
 * `/agendar/[casa]/horarios`, `/agendar/[casa]/confirmar` — e cada troca de
 * passo era uma navegação inteira: voltar perdia o carrinho, mudar de ideia
 * sobre a profissional obrigava a recomeçar, e o carrinho viajava na
 * querystring porque não havia onde o guardar.
 *
 * Agora é uma tela só, e o estado vive nela. Este arquivo é o que a tela
 * pergunta ao servidor: o catálogo da casa, quem faz aquele carrinho, e que
 * horas existem no período. Três perguntas, cada uma numa consulta.
 *
 * A regra que não muda: o cliente escolhe um INSTANTE, nunca um plano. Quem
 * decide qual profissional pega qual serviço, em que cadeira e com que buraco
 * de processamento é o motor, no servidor, no momento de gravar — senão duas
 * clientes a olhar para a mesma tela marcavam a mesma cadeira.
 */

import { addDaysInZone, priceRange, resolvePrice } from '@studio/core'
import type {
  CasaEscolhivel,
  DiaLivre,
  HorarioLivre,
  ProfissionalEscolhivel,
  ServicoEscolhivel,
} from '@/lib/marcacao-tipos'
import { formatMoney } from '@/lib/format'
import { findSlots, todayInUnit } from './availability'
import {
  deliverableServices,
  getUnitBySlug,
  listUnits,
  loadBookingContext,
  staffForCart,
  type BookingContext,
  type UnitInfo,
} from './context'
import { frasePorta, portaDasUnidades } from './hoje'

/** Quantos dias a tira de dias mostra de uma vez. */
export const JANELA_DIAS = 14

export async function casasEscolhiveis(): Promise<CasaEscolhivel[]> {
  const unidades = await listUnits()
  const portas = await portaDasUnidades(unidades)

  return unidades.map((unidade) => {
    const porta = portas.get(unidade.id)
    return {
      slug: unidade.slug,
      nome: unidade.name,
      distrito: unidade.district,
      morada: unidade.addressLine,
      imagemUrl: unidade.imageUrl,
      frase: porta ? frasePorta(porta.estado) : null,
      aberta: porta?.estado.tipo === 'aberta',
    }
  })
}

/**
 * O catálogo da casa, já com o preço que a tela pode escrever.
 *
 * Só o que a casa ENTREGA: serviço sem ninguém habilitado na equipa local ou
 * sem o recurso instalado não aparece. Publicar o catálogo da rede numa loja
 * que não o executa é vender o que não se tem.
 */
export async function catalogoDaCasa(slug: string): Promise<ServicoEscolhivel[]> {
  const unidade = await getUnitBySlug(slug)
  if (!unidade) return []

  const hoje = todayInUnit(unidade)
  const ctx = await loadBookingContext({ unit: unidade, fromDate: hoje, toDate: hoje })
  const catalogo = deliverableServices(ctx, { onlineOnly: true })

  return catalogo.map((servico) => {
    const base = {
      serviceId: servico.id,
      unitId: unidade.id,
      basePrice: servico.basePrice,
      baseDurationMin: servico.clientDurationMin,
    }
    const { durationMin } = resolvePrice(ctx.priceOverrides, base)
    const faixa = priceRange(
      ctx.priceOverrides,
      base,
      staffForCart(ctx, [servico.id], { onlineOnly: true }).map((pessoa) => pessoa.id),
    )

    return {
      id: servico.id,
      nome: servico.name,
      descricao: servico.description,
      categoria: (servico.categoryId && ctx.categories.get(servico.categoryId)) || 'Outros',
      preco: faixa.min,
      precoVaria: faixa.varies,
      duracaoMin: durationMin,
      imagemUrl: servico.imageUrl,
      sinal: rotuloDeSinal(servico.deposit, faixa.min),
      exigeAnamnese: servico.requiresAnamnesis,
    }
  })
}

/** Quem consegue fazer o carrinho inteiro nesta casa. */
export async function profissionaisPara(
  slug: string,
  servicoIds: readonly string[],
): Promise<ProfissionalEscolhivel[]> {
  if (servicoIds.length === 0) return []
  const unidade = await getUnitBySlug(slug)
  if (!unidade) return []

  const hoje = todayInUnit(unidade)
  /* A janela inteira, não só hoje: quem está de folga hoje continua a ser uma
     escolha para a semana que vem, e desaparecer da lista por causa de um dia
     faria a cliente pensar que a pessoa saiu do salão. */
  const ctx = await loadBookingContext({
    unit: unidade,
    fromDate: hoje,
    toDate: addDaysInZone(hoje, JANELA_DIAS),
  })

  return staffForCart(ctx, servicoIds, { onlineOnly: true }).map((pessoa) => ({
    id: pessoa.id,
    nome: pessoa.name,
    cor: pessoa.color,
  }))
}

/**
 * Os dias e as horas do período, numa consulta só.
 *
 * O motor varre o intervalo inteiro de uma vez — carregar o contexto uma vez e
 * varrer é muito mais barato do que uma consulta por dia, que era o que a tela
 * antiga fazia a cada clique na seta do calendário.
 *
 * O tecto de horários existe para a resposta não crescer sem limite com uma
 * equipa grande. Ele corta o FIM do período (o motor devolve por ordem de
 * início), então o que se perde são os dias mais distantes — e a tira de dias
 * diz isso em vez de os mostrar como fechados.
 */
export async function diasComHorarios(
  slug: string,
  servicoIds: readonly string[],
  staffId: string | null,
  /** `null` = a partir de hoje na casa. Quem sabe que dia é hoje ali é o servidor. */
  deData: string | null,
  dias = JANELA_DIAS,
): Promise<DiaLivre[]> {
  const unidade = await getUnitBySlug(slug)
  if (!unidade || servicoIds.length === 0) return []

  const inicio = deData ?? todayInUnit(unidade)
  const ate = addDaysInZone(inicio, dias - 1)
  const ctx = await loadBookingContext({ unit: unidade, fromDate: inicio, toDate: ate })

  const horarios = findSlots(ctx, {
    cart: servicoIds.map((serviceId) => ({
      serviceId,
      ...(staffId ? { staffId } : {}),
    })),
    onlineOnly: true,
    limit: 4000,
  })

  const porDia = new Map<string, HorarioLivre[]>()
  for (const horario of horarios) {
    const data = dataDeParede(horario.start, unidade.timezone)
    const lista = porDia.get(data) ?? []
    lista.push({
      inicio: horario.start,
      hora: horaDeParede(horario.start, unidade.timezone),
      precoTotal: horario.totalPrice,
      duracaoMin: horario.totalDurationMin,
      equipa: horario.items.map((item) => ({
        servicoId: item.serviceId,
        servicoNome: item.serviceName,
        staffId: item.staffId,
        nome: item.staffName,
        preco: item.price,
      })),
    })
    porDia.set(data, lista)
  }

  const resultado: DiaLivre[] = []
  for (let i = 0; i < dias; i++) {
    const data = addDaysInZone(inicio, i)
    resultado.push({
      data,
      fechada: (ctx.openRangesByDate.get(data)?.length ?? 0) === 0,
      horarios: porDia.get(data) ?? [],
    })
  }
  return resultado
}

/** Data de parede de um instante ISO, no fuso da casa. `en-CA` dá `YYYY-MM-DD`. */
function dataDeParede(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: timezone })
}

/** "14:30" na casa. Relógio de 24 horas, que é como se escreve hora cá. */
function horaDeParede(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
}

function rotuloDeSinal(
  sinal: { type: 'percent'; bps: number } | { type: 'fixed'; cents: number } | null,
  preco: number,
): string | null {
  if (!sinal) return null
  if (sinal.type === 'fixed') return formatMoney(sinal.cents)
  return `${sinal.bps / 100}% (${formatMoney(Math.round((preco * sinal.bps) / 10_000))})`
}

/** Reexportado para as acções não terem de conhecer o módulo de contexto. */
export type { BookingContext, UnitInfo }
