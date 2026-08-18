import 'server-only'

/**
 * A vitrine: tudo que a página pública da loja mostra.
 *
 * Separada do contexto de disponibilidade de propósito. Aquele existe para
 * responder "que horários cabem" e carrega escala, folga, recurso e ocupação;
 * esta responde "que casa é esta" e carrega fotografia, morada, horário e
 * preçário. Uma pergunta é de motor, a outra é de montra — e quem abre o link
 * do Instagram só fez a segunda.
 *
 * O preçário aqui é documento publicado, não simulação de agendamento: preço da
 * unidade, sem variação por profissional. Quando a variação existir de verdade,
 * é a tela de marcação que a mostra, no momento em que a cliente escolhe quem
 * atende — prometer uma faixa numa lista impressa só faz duvidar do número.
 */

import { resolvePrice, type PriceOverride } from '@studio/core'
import {
  organizations,
  serviceCategories,
  servicePricing,
  services,
  unitHours,
  unitPhotos,
} from '@studio/db'
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { getUnitBySlug, type UnitInfo } from './scheduling/context'
import { portaDaUnidade, type HojeNaLoja } from './scheduling/hoje'

export interface FotoDaLoja {
  url: string
  alt: string | null
}

export interface ItemPrecario {
  id: string
  nome: string
  descricao: string | null
  /** Em cêntimos. */
  preco: number
  duracaoMin: number
  /** Serviço que só fecha preço depois de ver o cabelo. */
  requerAvaliacao: boolean
}

export interface GrupoPrecario {
  id: string
  nome: string
  /** A ressalva ao pé do bloco, como no preçário impresso. */
  nota: string | null
  itens: ItemPrecario[]
}

export interface DiaDaSemana {
  /** 0 = domingo … 6 = sábado */
  weekday: number
  /** Vazio = fechado nesse dia. */
  janelas: { abre: string; fecha: string }[]
}

export interface Loja {
  unidade: UnitInfo
  fotos: FotoDaLoja[]
  hoje: HojeNaLoja
  semana: DiaDaSemana[]
  precario: GrupoPrecario[]
}

export async function lojaPorSlug(slug: string): Promise<Loja | null> {
  const unidade = await getUnitBySlug(slug)
  if (!unidade) return null

  const [fotos, hoje, semana, precario] = await Promise.all([
    fotosDaLoja(unidade.id),
    portaDaUnidade(unidade),
    semanaDaLoja(unidade.id),
    precarioDaLoja(unidade.id),
  ])

  return { unidade, fotos, hoje, semana, precario }
}

/**
 * O que é da rede e não da loja: o nome e as redes sociais.
 *
 * Mora em `organizations.settings` porque o Instagram é um só para as duas
 * casas — o mesmo perfil publica as fotos de Valongo e da Maia. Coluna própria
 * seria melhor, mas `settings` já existe, é jsonb e ninguém escreve nele: o
 * formulário de unidade reescreve `units.settings`, não este. Verificado antes
 * de guardar aqui, porque um campo que outro formulário apaga em silêncio é
 * exatamente o defeito que a tabela `unit_photos` veio evitar.
 */
export interface Rede {
  nome: string
  /** Sem `@` e sem URL — só o identificador. Nulo quando não foi declarado. */
  instagram: string | null
}

export async function rede(): Promise<Rede | null> {
  const [org] = await db
    .select({ nome: organizations.name, settings: organizations.settings })
    .from(organizations)
    .limit(1)
  if (!org) return null

  const bruto = org.settings?.instagram
  const instagram =
    typeof bruto === 'string' && bruto.trim() ? bruto.trim().replace(/^@+/, '') : null

  return { nome: org.nome, instagram }
}

async function fotosDaLoja(unitId: string): Promise<FotoDaLoja[]> {
  const rows = await db
    .select({ url: unitPhotos.url, alt: unitPhotos.alt })
    .from(unitPhotos)
    .where(eq(unitPhotos.unitId, unitId))
    .orderBy(asc(unitPhotos.sortOrder), asc(unitPhotos.createdAt))
  return rows
}

async function semanaDaLoja(unitId: string): Promise<DiaDaSemana[]> {
  const rows = await db
    .select()
    .from(unitHours)
    .where(eq(unitHours.unitId, unitId))
    .orderBy(asc(unitHours.weekday), asc(unitHours.opensAt))

  /* Sem uma linha sequer, a loja não declarou horário — e a página não inventa
     uma semana de segunda a sábado que ninguém confirmou. Lista vazia é o sinal
     de "ainda não sei", e a tela trata isso à parte. */
  if (rows.length === 0) return []

  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    janelas: rows
      .filter((r) => r.weekday === weekday)
      .map((r) => ({ abre: r.opensAt.slice(0, 5), fecha: r.closesAt.slice(0, 5) })),
  }))
}

async function precarioDaLoja(unitId: string): Promise<GrupoPrecario[]> {
  const orgId = sql<string>`(select organization_id from units where id = ${unitId})`

  const [categorias, catalogo, overrides] = await Promise.all([
    db
      .select({
        id: serviceCategories.id,
        nome: serviceCategories.name,
        nota: serviceCategories.note,
      })
      .from(serviceCategories)
      .where(and(eq(serviceCategories.organizationId, orgId), eq(serviceCategories.active, true)))
      .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name)),
    db
      .select()
      .from(services)
      .where(and(eq(services.organizationId, orgId), eq(services.active, true)))
      .orderBy(asc(services.sortOrder), asc(services.name)),
    db
      .select()
      .from(servicePricing)
      .where(
        and(
          /* Só a régua da casa: preço de profissional não entra em preçário. */
          isNull(servicePricing.staffId),
          or(isNull(servicePricing.unitId), eq(servicePricing.unitId, unitId)),
        ),
      ),
  ])

  const tabela: PriceOverride[] = overrides.map((row) => ({
    serviceId: row.serviceId,
    unitId: row.unitId,
    staffId: null,
    price: row.price,
    durationOverrideMin: row.durationOverrideMin,
  }))

  const porCategoria = new Map<string, ItemPrecario[]>()
  for (const servico of catalogo) {
    const base = servico.setupMin + servico.processingMin + servico.finishMin
    const { price, durationMin } = resolvePrice(tabela, {
      serviceId: servico.id,
      unitId,
      basePrice: servico.basePrice,
      baseDurationMin: base,
    })

    /* Serviço sem categoria vai para um balde próprio em vez de sumir: o
       preçário é a lista completa da casa, e uma linha que não aparece é uma
       linha que a recepção vai cobrar de cabeça. */
    const chave = servico.categoryId ?? '—'
    const lista = porCategoria.get(chave) ?? []
    lista.push({
      id: servico.id,
      nome: servico.name,
      descricao: servico.description,
      preco: price,
      duracaoMin: durationMin,
      requerAvaliacao: servico.requiresAssessment,
    })
    porCategoria.set(chave, lista)
  }

  const grupos: GrupoPrecario[] = categorias
    .map((c) => ({ id: c.id, nome: c.nome, nota: c.nota, itens: porCategoria.get(c.id) ?? [] }))
    .filter((g) => g.itens.length > 0)

  const soltos = porCategoria.get('—')
  if (soltos && soltos.length > 0) {
    grupos.push({ id: '—', nome: 'Outros serviços', nota: null, itens: soltos })
  }

  return grupos
}
