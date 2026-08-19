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

const SPECIFICITY: Record<CommissionSource, number> = {
  staff_service: 3,
  staff: 2,
  service: 1,
  default: 0,
}

/**
 * A regra sem profissional e sem serviço é a regra da casa — o último degrau da
 * cadeia, não uma linha inválida.
 *
 * Era aqui que se perdia a comissão de toda a gente. `classify` devolvia `null`
 * para essa linha e o ciclo saltava-a, pelo que o percentual caía no
 * `defaultPercentBps`, que vale 0 e que o único chamador não preenche. A dona
 * gravava «40% — todos · todos» em /admin/comissoes, a regra aparecia na lista,
 * e toda a comanda fechada a seguir escrevia `percent_bps = 0` e `amount = 0`.
 * O mapa de comissões dizia que não havia nada a pagar a ninguém, sem erro
 * nenhum a explicar porquê — e a regra geral é a que quase todo o salão usa.
 *
 * `resolvePrice` tem a mesma forma e não tinha o defeito, porque o CHECK
 * `service_pricing_has_target` torna a linha sem alvo impossível na base. Em
 * `commission_rules` não existe CHECK equivalente: a linha sem alvo existe
 * mesmo, e é de propósito.
 */
function classify(rule: CommissionRule): CommissionSource {
  const hasStaff = Boolean(rule.staffId)
  const hasService = Boolean(rule.serviceId)
  if (hasStaff && hasService) return 'staff_service'
  if (hasStaff) return 'staff'
  if (hasService) return 'service'
  return 'default'
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
  let best: { rule: CommissionRule; source: CommissionSource } | null = null

  for (const rule of rules) {
    if (!applies(rule, staffId, serviceId)) continue
    const source = classify(rule)
    if (!best || SPECIFICITY[source] > SPECIFICITY[best.source]) {
      best = { rule, source }
    }
  }

  const percentBps = best?.rule.percentBps ?? defaultPercentBps
  const source = best?.source ?? 'default'
  return { percentBps, amount: Math.round((baseAmount * percentBps) / 10_000), source }
}
