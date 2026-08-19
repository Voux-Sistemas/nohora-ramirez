import { describe, expect, it } from 'vitest'
import { ratearDesconto } from './rateio.js'

const soma = (ns: readonly number[]) => ns.reduce((a, b) => a + b, 0)

describe('rateio do desconto pelos itens', () => {
  it('reparte na proporção do preço', () => {
    expect(ratearDesconto([6000, 2000, 2000], 1000)).toEqual([600, 200, 200])
  })

  it('não perde cêntimo quando a divisão não é exata', () => {
    /* Três itens de 30 €, 10 € de desconto. Arredondando linha a linha dava
       3,33 × 3 = 9,99 e faltava um cêntimo. Aqui o cêntimo cai numa das linhas
       — qual delas é o que o acumulado decidir — e a soma fecha em 10 €. */
    const partes = ratearDesconto([3000, 3000, 3000], 1000)
    expect(soma(partes)).toBe(1000)
    expect(partes).toEqual([333, 334, 333])
  })

  it('a soma bate com o desconto em qualquer combinação', () => {
    const casos: readonly (readonly [number[], number])[] = [
      [[1000], 137],
      [[1050, 2075, 999], 733],
      [[100, 100, 100, 100, 100, 100, 100], 1],
      [[4999, 1], 2500],
    ]
    for (const [precos, desconto] of casos) {
      expect(soma(ratearDesconto(precos, desconto))).toBe(desconto)
    }
  })

  it('nenhum item leva desconto maior do que o próprio preço', () => {
    const precos = [500, 9500]
    const partes = ratearDesconto(precos, 10000)
    partes.forEach((parte, i) => expect(parte).toBeLessThanOrEqual(precos[i]!))
    expect(soma(partes)).toBe(10000)
  })

  it('comanda sem desconto não mexe em nada', () => {
    expect(ratearDesconto([3000, 2000], 0)).toEqual([0, 0])
  })

  it('comanda toda oferecida não divide por zero', () => {
    expect(ratearDesconto([0, 0], 500)).toEqual([0, 0])
    expect(ratearDesconto([], 500)).toEqual([])
  })
})
