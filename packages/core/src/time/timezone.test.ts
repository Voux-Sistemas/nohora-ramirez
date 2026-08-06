import { describe, expect, it } from 'vitest'
import {
  addDaysInZone,
  isoDateInZone,
  isoTimeInZone,
  toZonedParts,
  weekdayInZone,
  weekdayOfIsoDate,
  zonedDateTime,
  zoneOffsetMs,
} from './timezone.js'

const SP = 'America/Sao_Paulo'
const NY = 'America/New_York'

describe('zonedDateTime', () => {
  it('converte hora de parede de São Paulo para UTC', () => {
    // São Paulo é UTC-3 o ano inteiro desde 2019
    expect(zonedDateTime('2026-08-10', '09:00', SP).toISOString()).toBe('2026-08-10T12:00:00.000Z')
  })

  it('converte a meia-noite sem cair no dia anterior', () => {
    expect(zonedDateTime('2026-08-10', '00:00', SP).toISOString()).toBe('2026-08-10T03:00:00.000Z')
  })

  it('respeita o horário de verão de um fuso que ainda o pratica', () => {
    // Nova York: -05:00 no inverno, -04:00 no verão
    expect(zonedDateTime('2026-01-15', '09:00', NY).toISOString()).toBe('2026-01-15T14:00:00.000Z')
    expect(zonedDateTime('2026-07-15', '09:00', NY).toISOString()).toBe('2026-07-15T13:00:00.000Z')
  })

  it('é o inverso de isoDateInZone/isoTimeInZone', () => {
    const instant = zonedDateTime('2026-11-03', '19:45', SP)
    expect(isoDateInZone(instant, SP)).toBe('2026-11-03')
    expect(isoTimeInZone(instant, SP)).toBe('19:45')
  })
})

describe('toZonedParts', () => {
  it('decompõe um instante no fuso pedido', () => {
    const p = toZonedParts(new Date('2026-08-10T12:00:00Z'), SP)
    expect(p).toMatchObject({ year: 2026, month: 8, day: 10, hour: 9, minute: 0, weekday: 1 })
  })

  it('o mesmo instante cai em dias diferentes conforme o fuso', () => {
    const instant = new Date('2026-08-11T02:00:00Z')
    expect(isoDateInZone(instant, SP)).toBe('2026-08-10')
    expect(isoDateInZone(instant, 'UTC')).toBe('2026-08-11')
  })
})

describe('zoneOffsetMs', () => {
  it('devolve -3h para São Paulo', () => {
    expect(zoneOffsetMs(new Date('2026-08-10T12:00:00Z'), SP)).toBe(-3 * 3600_000)
  })
})

describe('weekday', () => {
  it('weekdayInZone usa o fuso, não o do servidor', () => {
    // domingo 23h em SP ainda é domingo, mesmo já sendo segunda em UTC
    expect(weekdayInZone(new Date('2026-08-10T02:00:00Z'), SP)).toBe(0)
    expect(weekdayInZone(new Date('2026-08-10T02:00:00Z'), 'UTC')).toBe(1)
  })

  it('weekdayOfIsoDate lê a data de parede', () => {
    expect(weekdayOfIsoDate('2026-08-10')).toBe(1) // segunda
    expect(weekdayOfIsoDate('2026-08-15')).toBe(6) // sábado
  })
})

describe('addDaysInZone', () => {
  it('soma e subtrai dias', () => {
    expect(addDaysInZone('2026-08-10', 5)).toBe('2026-08-15')
    expect(addDaysInZone('2026-08-10', -11)).toBe('2026-07-30')
  })

  it('atravessa a virada de ano', () => {
    expect(addDaysInZone('2026-12-30', 3)).toBe('2027-01-02')
  })
})
