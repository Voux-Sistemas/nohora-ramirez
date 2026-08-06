/**
 * Resolução de comissão. Mesma lógica de `resolvePrice`, precedência do mais
 * específico ao mais genérico:
 *
 *   profissional + serviço  →  profissional  →  serviço  →  padrão da rede
 *
 * Percentual em pontos-base (3000 = 30%) — nunca float.
 */

export interface CommissionRule {
  readonly staffId?: string | null
  readonly serviceId?: string | null
  readonly percentBps: number
}

export type CommissionSource = 'staff_service' | 'staff' | 'service' | 'default'

export interface ResolvedCommission {
  readonly percentBps: number
  readonly amount: number
  readonly source: CommissionSource
}

const SPECIFICITY: Record<Exclude<CommissionSource, 'default'>, number> = {
  staff_service: 3,
  staff: 2,
  service: 1,
}

function classify(rule: CommissionRule): Exclude<CommissionSource, 'default'> | null {
  const hasStaff = Boolean(rule.staffId)
  const hasService = Boolean(rule.serviceId)
  if (hasStaff && hasService) return 'staff_service'
  if (hasStaff) return 'staff'
  if (hasService) return 'service'
  return null
}

function applies(rule: CommissionRule, staffId: string, serviceId: string): boolean {
  if (rule.staffId && rule.staffId !== staffId) return false
  if (rule.serviceId && rule.serviceId !== serviceId) return false
  return true
}

export function resolveCommission(
  rules: readonly CommissionRule[],
  staffId: string,
  serviceId: string,
  baseAmount: number,
  defaultPercentBps = 0,
): ResolvedCommission {
  let best: { rule: CommissionRule; source: Exclude<CommissionSource, 'default'> } | null = null

  for (const rule of rules) {
    if (!applies(rule, staffId, serviceId)) continue
    const source = classify(rule)
    if (!source) continue
    if (!best || SPECIFICITY[source] > SPECIFICITY[best.source]) {
      best = { rule, source }
    }
  }

  const percentBps = best?.rule.percentBps ?? defaultPercentBps
  const source = best?.source ?? 'default'
  return { percentBps, amount: Math.round((baseAmount * percentBps) / 10_000), source }
}
