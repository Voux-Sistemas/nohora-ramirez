import { describe, expect, it } from 'vitest'
import { agruparPorFuso, janelaDoMes } from './mes.js'

const LISBOA = 'Europe/Lisbon'

describe('janelaDoMes', () => {
  it('abre o mês na meia-noite local e fecha na do mês seguinte', () => {
    // 13 de agosto de 2026, 10:00 em Lisboa (verão: UTC+1)
    const mes = janelaDoMes(new Date('2026-08-13T09:00:00Z'), LISBOA)

    expect(mes.diaDoMes).toBe(13)
    expect(mes.dias).toBe(31)
    expect(mes.inicioIso).toBe('2026-08-01')
    expect(mes.inicioTs).toBe('2026-07-31T23:00:00.000Z')
    expect(mes.fimTs).toBe('2026-08-31T23:00:00.000Z')
  })

  it('compara com o mesmo trecho do mês anterior, não com o mês inteiro', () => {
    const mes = janelaDoMes(new Date('2026-08-13T09:00:00Z'), LISBOA)

    // 1 a 13 de julho, com o fim exclusivo na meia-noite do dia 14 — a mesma
    // contagem de dias que agosto já correu. Sem isto, agosto pela metade
    // pareceria sempre murcho ao lado de um julho fechado.
    expect(mes.anteriorInicioTs).toBe('2026-06-30T23:00:00.000Z')
    expect(mes.anteriorFimTs).toBe('2026-07-13T23:00:00.000Z')
  })

  it('não deixa o trecho anterior transbordar para o mês corrente', () => {
    // 31 de março contra um fevereiro de 28 dias: 1 de fevereiro + 31 dias cai
    // em 4 de março. O corte tem de parar em 1 de março.
    const mes = janelaDoMes(new Date('2026-03-31T10:00:00Z'), LISBOA)

    expect(mes.diaDoMes).toBe(31)
    expect(mes.anteriorFimTs).toBe(mes.inicioTs)
  })

  it('vira o ano nos dois sentidos', () => {
    const janeiro = janelaDoMes(new Date('2026-01-10T12:00:00Z'), LISBOA)
    expect(janeiro.anteriorInicioTs).toBe('2025-12-01T00:00:00.000Z')
    expect(janeiro.fimTs).toBe('2026-02-01T00:00:00.000Z')

    const dezembro = janelaDoMes(new Date('2026-12-10T12:00:00Z'), LISBOA)
    expect(dezembro.fimTs).toBe('2027-01-01T00:00:00.000Z')
  })

  it('conta os dias de fevereiro bissexto', () => {
    expect(janelaDoMes(new Date('2028-02-10T12:00:00Z'), LISBOA).dias).toBe(29)
    expect(janelaDoMes(new Date('2026-02-10T12:00:00Z'), LISBOA).dias).toBe(28)
  })

  it('usa o fuso da loja, não o do servidor', () => {
    // 23:30 de 31 de julho em UTC ainda é julho em Lisboa? Não: Lisboa está
    // em UTC+1 no verão, portanto já é 1 de agosto, e o mês tem de virar.
    const mes = janelaDoMes(new Date('2026-07-31T23:30:00Z'), LISBOA)
    expect(mes.inicioIso).toBe('2026-08-01')
    expect(mes.diaDoMes).toBe(1)
  })
})

describe('agruparPorFuso', () => {
  it('junta as lojas do mesmo fuso num grupo só', () => {
    const grupos = agruparPorFuso([
      { id: 'a', timezone: LISBOA },
      { id: 'b', timezone: 'America/Sao_Paulo' },
      { id: 'c', timezone: LISBOA },
    ])

    expect(grupos.size).toBe(2)
    expect(grupos.get(LISBOA)?.map((u) => u.id)).toEqual(['a', 'c'])
    expect(grupos.get('America/Sao_Paulo')?.map((u) => u.id)).toEqual(['b'])
  })

  it('devolve um mapa vazio para lista vazia', () => {
    expect(agruparPorFuso([]).size).toBe(0)
  })
})
