import { describe, expect, it } from 'vitest'
import {
  containedInAny,
  contains,
  intersectRanges,
  mergeRanges,
  overlaps,
  subtractRanges,
  totalMinutes,
  type TimeRange,
} from './range.js'

const DAY = '2026-08-10'
const at = (time: string, day = DAY): Date => new Date(`${day}T${time}:00.000Z`)
const range = (a: string, b: string, day = DAY): TimeRange => ({
  start: at(a, day),
  end: at(b, day),
})
const asText = (ranges: TimeRange[]): string[] =>
  ranges.map((r) => `${r.start.toISOString().slice(11, 16)}-${r.end.toISOString().slice(11, 16)}`)

describe('overlaps — intervalos semiabertos', () => {
  it('detecta sobreposição real', () => {
    expect(overlaps(range('09:00', '10:00'), range('09:30', '10:30'))).toBe(true)
  })

  it('NÃO considera sobreposição quando os intervalos apenas se encostam', () => {
    // é o que permite encostar dois atendimentos sem falso conflito
    expect(overlaps(range('09:00', '10:00'), range('10:00', '11:00'))).toBe(false)
  })

  it('detecta contenção total', () => {
    expect(overlaps(range('09:00', '12:00'), range('10:00', '11:00'))).toBe(true)
  })
})

describe('contains', () => {
  it('aceita intervalo idêntico', () => {
    expect(contains(range('09:00', '10:00'), range('09:00', '10:00'))).toBe(true)
  })

  it('recusa quando extrapola por um minuto', () => {
    expect(contains(range('09:00', '10:00'), range('09:00', '10:01'))).toBe(false)
  })

  it('containedInAny encontra a janela certa', () => {
    const windows = [range('09:00', '12:00'), range('13:00', '18:00')]
    expect(containedInAny(range('14:00', '15:00'), windows)).toBe(true)
    // atravessa o almoço → não cabe em nenhuma janela isolada
    expect(containedInAny(range('11:00', '14:00'), windows)).toBe(false)
  })
})

describe('mergeRanges', () => {
  it('funde sobrepostos e encostados, e ordena', () => {
    const merged = mergeRanges([
      range('10:00', '11:00'),
      range('09:00', '09:30'),
      range('09:30', '10:00'),
      range('10:30', '12:00'),
    ])
    expect(asText(merged)).toEqual(['09:00-12:00'])
  })

  it('mantém separados os que têm folga entre si', () => {
    const merged = mergeRanges([range('09:00', '10:00'), range('10:15', '11:00')])
    expect(asText(merged)).toEqual(['09:00-10:00', '10:15-11:00'])
  })

  it('descarta intervalos vazios ou invertidos', () => {
    expect(mergeRanges([range('09:00', '09:00'), range('11:00', '10:00')])).toEqual([])
  })
})

describe('subtractRanges', () => {
  it('abre um buraco no meio', () => {
    const result = subtractRanges([range('09:00', '18:00')], [range('12:00', '13:00')])
    expect(asText(result)).toEqual(['09:00-12:00', '13:00-18:00'])
  })

  it('corta as bordas', () => {
    const result = subtractRanges(
      [range('09:00', '18:00')],
      [range('08:00', '10:00'), range('17:30', '19:00')],
    )
    expect(asText(result)).toEqual(['10:00-17:30'])
  })

  it('devolve vazio quando o corte cobre tudo', () => {
    expect(subtractRanges([range('09:00', '12:00')], [range('08:00', '13:00')])).toEqual([])
  })

  it('ignora cortes que não tocam a base', () => {
    const result = subtractRanges([range('09:00', '12:00')], [range('14:00', '15:00')])
    expect(asText(result)).toEqual(['09:00-12:00'])
  })
})

describe('intersectRanges', () => {
  it('cruza escala do profissional com horário da unidade', () => {
    const unidade = [range('09:00', '12:00'), range('13:00', '18:00')]
    const escala = [range('10:00', '16:00')]
    expect(asText(intersectRanges(unidade, escala))).toEqual(['10:00-12:00', '13:00-16:00'])
  })

  it('devolve vazio quando não há interseção', () => {
    expect(intersectRanges([range('09:00', '12:00')], [range('13:00', '18:00')])).toEqual([])
  })
})

describe('totalMinutes', () => {
  it('não conta duas vezes o período sobreposto', () => {
    expect(totalMinutes([range('09:00', '11:00'), range('10:00', '12:00')])).toBe(180)
  })
})
