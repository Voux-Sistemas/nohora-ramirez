/**
 * Resolução de preço e duração.
 *
 * O mesmo serviço custa e demora coisas diferentes dependendo de quem faz e de
 * onde é feito. A regra de precedência, do mais específico para o mais genérico:
 *
 *   profissional + unidade  →  profissional  →  unidade  →  preço base
 *
 * Todo valor monetário é INTEIRO EM CENTAVOS. Nunca float — dinheiro com
 * ponto flutuante gera divergência de centavo no fechamento do caixa.
 */

export interface PriceOverride {
  readonly serviceId: string
  /** Null/ausente = vale para toda a rede. */
  readonly unitId?: string | null
  /** Null/ausente = vale para qualquer profissional. */
  readonly staffId?: string | null
  /** Preço em centavos. */
  readonly price: number
  /** Duração total em minutos, se este contexto demora diferente. */
  readonly durationOverrideMin?: number | null
}

export interface PriceContext {
  readonly serviceId: string
  readonly unitId: string
  readonly staffId?: string
  /** Preço base do catálogo, em centavos. */
  readonly basePrice: number
  readonly baseDurationMin: number
}

export type PriceSource = 'staff_unit' | 'staff' | 'unit' | 'base'

export interface ResolvedPrice {
  readonly price: number
  readonly durationMin: number
  readonly source: PriceSource
}

const SPECIFICITY: Record<Exclude<PriceSource, 'base'>, number> = {
  staff_unit: 3,
  staff: 2,
  unit: 1,
}

function classify(override: PriceOverride): Exclude<PriceSource, 'base'> | null {
  const hasStaff = Boolean(override.staffId)
  const hasUnit = Boolean(override.unitId)
  if (hasStaff && hasUnit) return 'staff_unit'
  if (hasStaff) return 'staff'
  if (hasUnit) return 'unit'
  return null
}

function applies(override: PriceOverride, ctx: PriceContext): boolean {
  if (override.serviceId !== ctx.serviceId) return false
  if (override.unitId && override.unitId !== ctx.unitId) return false
  if (override.staffId && override.staffId !== ctx.staffId) return false
  return true
}

export function resolvePrice(
  overrides: readonly PriceOverride[],
  ctx: PriceContext,
): ResolvedPrice {
  let best: { override: PriceOverride; source: Exclude<PriceSource, 'base'> } | null = null

  for (const override of overrides) {
    if (!applies(override, ctx)) continue
    const source = classify(override)
    if (!source) continue
    if (!best || SPECIFICITY[source] > SPECIFICITY[best.source]) {
      best = { override, source }
    }
  }

  if (!best) {
    return { price: ctx.basePrice, durationMin: ctx.baseDurationMin, source: 'base' }
  }

  return {
    price: best.override.price,
    durationMin: best.override.durationOverrideMin ?? ctx.baseDurationMin,
    source: best.source,
  }
}

export interface PriceRange {
  /** Menor preço possível na unidade, em centavos. */
  readonly min: number
  /** Maior preço possível na unidade, em centavos. */
  readonly max: number
  /** Verdadeiro quando escolher a profissional muda o que se paga. */
  readonly varies: boolean
}

/**
 * A faixa que o mesmo serviço pode custar numa unidade, conforme quem atende.
 *
 * Existe porque o cardápio aparece ANTES de escolher profissional: mostrar um
 * número exato ali é prometer um preço que a tela seguinte pode desmentir. Com a
 * faixa, o cardápio diz "a partir de" e a promessa se sustenta — o mínimo é o
 * mínimo de verdade, não o preço da unidade por acaso.
 *
 * `staffIds` são só as profissionais que podem executar o serviço naquela casa;
 * incluir quem não atende ali inventaria um preço que ninguém pratica.
 */
export function priceRange(
  overrides: readonly PriceOverride[],
  ctx: Omit<PriceContext, 'staffId'>,
  staffIds: readonly string[],
): PriceRange {
  // Sem equipe habilitada não há preço praticado: sobra o da unidade.
  if (staffIds.length === 0) {
    const { price } = resolvePrice(overrides, ctx)
    return { min: price, max: price, varies: false }
  }

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const staffId of staffIds) {
    const { price } = resolvePrice(overrides, { ...ctx, staffId })
    if (price < min) min = price
    if (price > max) max = price
  }
  return { min, max, varies: min !== max }
}

/**
 * Valor do sinal a ser cobrado no ato do agendamento.
 * `percent` vem em pontos-base (5000 = 50%) para não usar float.
 */
export function depositAmount(
  total: number,
  policy: { type: 'percent'; bps: number } | { type: 'fixed'; cents: number } | null,
): number {
  if (!policy) return 0
  const amount =
    policy.type === 'percent' ? Math.round((total * policy.bps) / 10_000) : policy.cents
  return Math.max(0, Math.min(amount, total))
}

/*
  Aqui existia um `formatBRL` travado em real, exportado pelo pacote e usado por
  ninguém além do próprio teste. Foi removido em vez de traduzido: formatação de
  moeda depende do país, o país vem do ambiente, e `packages/core` é domínio
  puro — não lê ambiente. Quem formata dinheiro é `apps/web/src/lib/format.ts`.

  O risco de deixar era o nome: duas funções iguais, uma delas devolvendo reais
  para um salão que cobra em euros, e o import errado não dá erro nenhum.
*/
