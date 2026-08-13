import { describe, expect, it } from 'vitest'
import {
  cartTotal,
  depositAmount,
  priceRange,
  resolvePrice,
  type PriceOverride,
} from './resolve.js'

const ctx = {
  serviceId: 'coloracao',
  unitId: 'centro',
  staffId: 'ana',
  basePrice: 20_000, // R$ 200,00
  baseDurationMin: 100,
}

describe('resolvePrice — precedência', () => {
  it('cai no preço base quando não há exceção', () => {
    expect(resolvePrice([], ctx)).toEqual({ price: 20_000, durationMin: 100, source: 'base' })
  })

  it('usa a exceção da unidade', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', unitId: 'centro', price: 22_000 },
    ]
    expect(resolvePrice(overrides, ctx)).toMatchObject({ price: 22_000, source: 'unit' })
  })

  it('profissional ganha da unidade', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', unitId: 'centro', price: 22_000 },
      { serviceId: 'coloracao', staffId: 'ana', price: 28_000 },
    ]
    expect(resolvePrice(overrides, ctx)).toMatchObject({ price: 28_000, source: 'staff' })
  })

  it('profissional + unidade ganha de todo o resto, independente da ordem da lista', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', staffId: 'ana', unitId: 'centro', price: 30_000 },
      { serviceId: 'coloracao', staffId: 'ana', price: 28_000 },
      { serviceId: 'coloracao', unitId: 'centro', price: 22_000 },
    ]
    expect(resolvePrice(overrides, ctx)).toMatchObject({ price: 30_000, source: 'staff_unit' })
  })

  it('ignora exceção de outra unidade ou de outro profissional', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', unitId: 'zona-sul', price: 25_000 },
      { serviceId: 'coloracao', staffId: 'bia', price: 26_000 },
    ]
    expect(resolvePrice(overrides, ctx)).toMatchObject({ price: 20_000, source: 'base' })
  })

  it('ignora exceção de outro serviço', () => {
    const overrides: PriceOverride[] = [{ serviceId: 'corte', staffId: 'ana', price: 9_000 }]
    expect(resolvePrice(overrides, ctx)).toMatchObject({ price: 20_000, source: 'base' })
  })

  it('a sênior também demora diferente', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', staffId: 'ana', price: 28_000, durationOverrideMin: 80 },
    ]
    expect(resolvePrice(overrides, ctx)).toEqual({
      price: 28_000,
      durationMin: 80,
      source: 'staff',
    })
  })

  it('mantém a duração base quando a exceção só mexe no preço', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', staffId: 'ana', price: 28_000 },
    ]
    expect(resolvePrice(overrides, ctx).durationMin).toBe(100)
  })

  it('funciona para cliente sem profissional escolhido', () => {
    const semStaff = { ...ctx, staffId: undefined }
    const overrides: PriceOverride[] = [
      { serviceId: 'coloracao', staffId: 'ana', price: 28_000 },
      { serviceId: 'coloracao', unitId: 'centro', price: 22_000 },
    ]
    // sem profissional definido, a exceção dele não se aplica
    expect(resolvePrice(overrides, semStaff)).toMatchObject({ price: 22_000, source: 'unit' })
  })
})

describe('cartTotal', () => {
  it('soma os itens da visita', () => {
    const total = cartTotal([
      { price: 9_000, durationMin: 30, source: 'base' },
      { price: 20_000, durationMin: 100, source: 'staff' },
    ])
    expect(total).toBe(29_000)
  })
})

describe('priceRange — o que o cardápio pode prometer', () => {
  const base = { serviceId: 'corte', unitId: 'centro', basePrice: 9_000, baseDurationMin: 60 }

  it('não varia quando ninguém tem preço próprio', () => {
    expect(priceRange([], base, ['ana', 'bia'])).toEqual({
      min: 9_000,
      max: 9_000,
      varies: false,
    })
  })

  it('abre a faixa quando uma profissional cobra diferente na unidade', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'corte', unitId: 'centro', staffId: 'bia', price: 8_000 },
    ]
    expect(priceRange(overrides, base, ['ana', 'bia'])).toEqual({
      min: 8_000,
      max: 9_000,
      varies: true,
    })
  })

  it('ignora exceção de profissional que não atende na unidade', () => {
    const overrides: PriceOverride[] = [{ serviceId: 'corte', staffId: 'bia', price: 15_000 }]
    expect(priceRange(overrides, base, ['ana'])).toEqual({
      min: 9_000,
      max: 9_000,
      varies: false,
    })
  })

  it('parte do preço da unidade quando não há equipe habilitada', () => {
    const overrides: PriceOverride[] = [{ serviceId: 'corte', unitId: 'centro', price: 11_000 }]
    expect(priceRange(overrides, base, [])).toEqual({
      min: 11_000,
      max: 11_000,
      varies: false,
    })
  })

  it('a exceção da unidade vale para toda a equipe sem preço próprio', () => {
    const overrides: PriceOverride[] = [
      { serviceId: 'corte', unitId: 'centro', price: 12_000 },
      { serviceId: 'corte', unitId: 'centro', staffId: 'ana', price: 14_000 },
    ]
    expect(priceRange(overrides, base, ['ana', 'bia'])).toEqual({
      min: 12_000,
      max: 14_000,
      varies: true,
    })
  })
})

describe('depositAmount', () => {
  it('devolve zero quando não há política de sinal', () => {
    expect(depositAmount(29_000, null)).toBe(0)
  })

  it('calcula percentual em pontos-base sem erro de arredondamento', () => {
    expect(depositAmount(29_000, { type: 'percent', bps: 3000 })).toBe(8_700) // 30%
    expect(depositAmount(9_999, { type: 'percent', bps: 5000 })).toBe(5_000) // arredonda
  })

  it('aceita valor fixo', () => {
    expect(depositAmount(29_000, { type: 'fixed', cents: 5_000 })).toBe(5_000)
  })

  it('nunca cobra mais que o total da visita', () => {
    expect(depositAmount(3_000, { type: 'fixed', cents: 5_000 })).toBe(3_000)
  })
})
