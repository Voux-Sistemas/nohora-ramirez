import { describe, expect, it } from 'vitest'
import { createRateLimiter, type Rule } from './rate-limit.js'

/** Regra curta e legível: três tentativas por minuto. */
const REGRA: Rule = { limit: 3, windowSec: 60 }

const T0 = 1_700_000_000_000

describe('rate limiter', () => {
  it('deixa passar até o limite e barra a seguinte', () => {
    const freio = createRateLimiter()

    expect(freio.hit('a', REGRA, T0).ok).toBe(true)
    expect(freio.hit('a', REGRA, T0 + 1000).ok).toBe(true)
    expect(freio.hit('a', REGRA, T0 + 2000).ok).toBe(true)

    const barrado = freio.hit('a', REGRA, T0 + 3000)
    expect(barrado.ok).toBe(false)
    expect(barrado.retryAfterSec).toBe(57)
  })

  it('conta cada chave separadamente', () => {
    const freio = createRateLimiter()

    for (let i = 0; i < 3; i += 1) freio.hit('a', REGRA, T0 + i)
    expect(freio.hit('a', REGRA, T0 + 10).ok).toBe(false)
    // Outro IP não paga pelo primeiro.
    expect(freio.hit('b', REGRA, T0 + 10).ok).toBe(true)
  })

  it('libera vaga conforme o acerto antigo sai da janela', () => {
    const freio = createRateLimiter()

    freio.hit('a', REGRA, T0)
    freio.hit('a', REGRA, T0 + 30_000)
    freio.hit('a', REGRA, T0 + 40_000)
    expect(freio.hit('a', REGRA, T0 + 50_000).ok).toBe(false)

    // Um milissegundo depois do primeiro completar 60s, a vaga dele abre.
    expect(freio.hit('a', REGRA, T0 + 60_001).ok).toBe(true)
  })

  it('não deixa passar o dobro na virada — o buraco da janela fixa', () => {
    const freio = createRateLimiter()

    // Três no fim de um minuto.
    freio.hit('a', REGRA, T0 + 57_000)
    freio.hit('a', REGRA, T0 + 58_000)
    freio.hit('a', REGRA, T0 + 59_000)

    // Numa janela fixa, o relógio virou e liberaria três de uma vez.
    expect(freio.hit('a', REGRA, T0 + 61_000).ok).toBe(false)
  })

  it('perdoa a tentativa que deu certo', () => {
    const freio = createRateLimiter()

    freio.hit('a', REGRA, T0)
    freio.hit('a', REGRA, T0 + 1000)
    freio.hit('a', REGRA, T0 + 2000)
    expect(freio.hit('a', REGRA, T0 + 3000).ok).toBe(false)

    freio.forgive('a')
    expect(freio.hit('a', REGRA, T0 + 3000).ok).toBe(true)
  })

  it('esquece a chave quando o perdão zera a contagem', () => {
    const freio = createRateLimiter()

    freio.hit('a', REGRA, T0)
    expect(freio.size()).toBe(1)

    freio.forgive('a')
    expect(freio.size()).toBe(0)
  })

  it('perdoar chave desconhecida não quebra nada', () => {
    const freio = createRateLimiter()
    expect(() => freio.forgive('nunca-vista')).not.toThrow()
  })

  it('não acumula instante vencido dentro da chave', () => {
    const freio = createRateLimiter()

    freio.hit('a', REGRA, T0)
    freio.hit('a', REGRA, T0 + 120_000)
    // O primeiro saiu da janela; a chave não guarda dois.
    expect(freio.hit('a', REGRA, T0 + 120_001).ok).toBe(true)
    expect(freio.hit('a', REGRA, T0 + 120_002).ok).toBe(true)
    expect(freio.hit('a', REGRA, T0 + 120_003).ok).toBe(false)
  })
})
