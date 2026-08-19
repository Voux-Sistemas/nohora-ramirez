import { describe, expect, it } from 'vitest'
import { resolveCommission } from './resolve'

/*
  A cadeia de precedência é a mesma do preço: profissional + serviço →
  profissional → serviço → padrão da rede. O que faltava aqui era o último
  degrau, e era justamente o que o salão usa: uma percentagem para toda a gente.
*/

const ANA = 'staff-ana'
const BEA = 'staff-bea'
const CORTE = 'svc-corte'
const COR = 'svc-cor'

describe('comissão', () => {
  it('a regra da casa vale para quem não tem regra própria', () => {
    /* «40% — todos · todos»: sem profissional e sem serviço. Era descartada, e
       toda a comanda fechada gravava zero. */
    const regras = [{ percentBps: 4000 }]
    const r = resolveCommission(regras, ANA, CORTE, 10_000)
    expect(r.source).toBe('default')
    expect(r.percentBps).toBe(4000)
    expect(r.amount).toBe(4000)
  })

  it('a regra da profissional passa à frente da regra da casa', () => {
    const regras = [{ percentBps: 4000 }, { staffId: ANA, percentBps: 5000 }]
    expect(resolveCommission(regras, ANA, CORTE, 10_000)).toMatchObject({
      source: 'staff',
      percentBps: 5000,
    })
    /* E quem não é a Ana continua nos 40% da casa. */
    expect(resolveCommission(regras, BEA, CORTE, 10_000)).toMatchObject({
      source: 'default',
      percentBps: 4000,
    })
  })

  it('profissional mais serviço ganha a tudo o resto', () => {
    const regras = [
      { percentBps: 4000 },
      { serviceId: COR, percentBps: 2000 },
      { staffId: ANA, percentBps: 5000 },
      { staffId: ANA, serviceId: COR, percentBps: 6000 },
    ]
    expect(resolveCommission(regras, ANA, COR, 10_000)).toMatchObject({
      source: 'staff_service',
      percentBps: 6000,
    })
    /* A ordem das regras na lista não pode mudar o resultado. */
    expect(resolveCommission([...regras].reverse(), ANA, COR, 10_000)).toMatchObject({
      source: 'staff_service',
      percentBps: 6000,
    })
  })

  it('a regra do serviço é o degrau acima da casa', () => {
    const regras = [{ percentBps: 4000 }, { serviceId: COR, percentBps: 2000 }]
    expect(resolveCommission(regras, BEA, COR, 10_000)).toMatchObject({
      source: 'service',
      percentBps: 2000,
    })
  })

  it('sem regra nenhuma não há comissão a pagar', () => {
    const r = resolveCommission([], ANA, CORTE, 10_000)
    expect(r).toEqual({ percentBps: 0, amount: 0, source: 'default' })
  })

  it('null e undefined no alvo contam como sem alvo', () => {
    /* A coluna vem da base com NULL, não com o campo ausente. */
    const r = resolveCommission([{ staffId: null, serviceId: null, percentBps: 3000 }], ANA, CORTE, 10_000)
    expect(r).toMatchObject({ source: 'default', percentBps: 3000 })
  })

  it('arredonda ao cêntimo, sem float solto', () => {
    /* 33,33% de 10,01 € = 3,336... € → 3,34 €. */
    expect(resolveCommission([{ percentBps: 3333 }], ANA, CORTE, 1001).amount).toBe(334)
  })
})
