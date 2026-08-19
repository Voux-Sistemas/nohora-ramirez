import { describe, expect, it } from 'vitest'
import { agruparProducao, type LinhaDeProducao } from './producao'

/**
 * O caso que interessa é o desconto: é onde a conta se pode perder ao cêntimo
 * e onde o número deixaria de bater com a comissão que o fecho da comanda
 * lançou pela mesma visita.
 */
function linha(campos: Partial<LinhaDeProducao> & { staffId: string; price: number }): LinhaDeProducao {
  return {
    appointmentId: 'a1',
    unitId: 'u1',
    staffName: campos.staffId,
    staffColor: '#95663a',
    serviceId: `s-${campos.staffId}`,
    serviceName: `serviço da ${campos.staffId}`,
    discount: 0,
    ...campos,
  }
}

describe('agruparProducao', () => {
  it('reparte o desconto da visita pelas duas profissionais, sem perder cêntimo', () => {
    /* Uma cliente, 100,00 € em dois serviços de mãos diferentes, 10,01 € de
       desconto ao balcão. O desconto é da visita e chega repetido em cada
       linha; contá-lo por item tirava 20,02 € em vez de 10,01 €. */
    const { porStaff } = agruparProducao([
      linha({ staffId: 'ana', price: 7000, discount: 1001 }),
      linha({ staffId: 'bia', price: 3000, discount: 1001 }),
    ])

    expect(porStaff.map((p) => [p.nome, p.liquido])).toEqual([
      ['ana', 6299],
      ['bia', 2700],
    ])
    // O que a cliente pagou, e não o que estava na etiqueta.
    expect(porStaff.reduce((soma, p) => soma + p.liquido, 0)).toBe(10_000 - 1001)
  })

  it('conta a visita uma vez por pessoa, mesmo com dois serviços da mesma mão', () => {
    const { porStaff, porServico } = agruparProducao([
      linha({ appointmentId: 'a1', staffId: 'ana', serviceId: 'escova', price: 2000 }),
      linha({ appointmentId: 'a1', staffId: 'ana', serviceId: 'cor', price: 5000 }),
      linha({ appointmentId: 'a2', staffId: 'ana', serviceId: 'escova', price: 2000 }),
    ])

    expect(porStaff[0]?.atendimentos).toBe(2)
    expect(porStaff[0]?.liquido).toBe(9000)
    // Serviço conta cada vez que foi feito — é a pergunta "o que sai mais".
    expect(porServico.map((s) => [s.serviceId, s.vezes, s.liquido])).toEqual([
      ['cor', 1, 5000],
      ['escova', 2, 4000],
    ])
  })

  it('parte o líquido de quem atende em duas lojas, e ordena pelo maior', () => {
    const { porStaff } = agruparProducao([
      linha({ appointmentId: 'a1', unitId: 'valongo', staffId: 'ana', price: 1800 }),
      linha({ appointmentId: 'a2', unitId: 'centro', staffId: 'ana', price: 6200 }),
    ])

    expect(porStaff[0]?.porUnidade).toEqual([
      { unitId: 'centro', liquido: 6200 },
      { unitId: 'valongo', liquido: 1800 },
    ])
  })

  it('ordena por líquido e desempata pelo nome', () => {
    const { porStaff } = agruparProducao([
      linha({ appointmentId: 'a1', staffId: 'duda', price: 5000 }),
      linha({ appointmentId: 'a2', staffId: 'bia', price: 9000 }),
      linha({ appointmentId: 'a3', staffId: 'ana', price: 5000 }),
    ])

    expect(porStaff.map((p) => p.nome)).toEqual(['bia', 'ana', 'duda'])
  })

  it('devolve listas vazias quando o mês não teve atendimento nenhum', () => {
    expect(agruparProducao([])).toEqual({ porStaff: [], porServico: [] })
  })
})
