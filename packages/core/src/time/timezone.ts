/**
 * Conversão de fuso.
 *
 * Regra do projeto: o banco guarda `timestamptz` em UTC e a conversão acontece
 * na borda, sempre com o fuso DA UNIDADE — não o do servidor nem o do navegador.
 * Uma rede pode ter unidade em São Paulo e em Manaus; assumir um fuso global é
 * o tipo de erro que só aparece quando alguém marca 8h e o sistema mostra 9h.
 *
 * Implementado em cima de `Intl`, sem dependência externa.
 */

export interface ZonedParts {
  readonly year: number
  /** 1–12 */
  readonly month: number
  readonly day: number
  readonly hour: number
  readonly minute: number
  readonly second: number
  /** 0 = domingo … 6 = sábado */
  readonly weekday: number
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatterCache.set(timeZone, f)
  }
  return f
}

/** Decompõe um instante UTC nos componentes de parede do fuso indicado. */
export function toZonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(instant)
  const pick = (type: Intl.DateTimeFormatPartTypes): string => {
    const found = parts.find((p) => p.type === type)
    if (!found) throw new Error(`componente ${type} ausente ao formatar em ${timeZone}`)
    return found.value
  }
  // 'en-US' com hour12:false devolve 24 para a meia-noite; normalizamos para 0
  const hour = Number(pick('hour')) % 24
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    hour,
    minute: Number(pick('minute')),
    second: Number(pick('second')),
    weekday: WEEKDAY_INDEX[pick('weekday')] ?? 0,
  }
}

/** Deslocamento do fuso naquele instante, em milissegundos (negativo a oeste). */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const p = toZonedParts(instant, timeZone)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // descarta os milissegundos do instante: `asIfUtc` não os tem
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Hora de parede → instante UTC.
 *
 * Duas passadas: a primeira estima o deslocamento, a segunda corrige quando o
 * palpite caiu do outro lado de uma virada de horário de verão.
 */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let ts = wall - zoneOffsetMs(new Date(wall), timeZone)
  ts = wall - zoneOffsetMs(new Date(ts), timeZone)
  return new Date(ts)
}

/** `'2026-08-10'` + `'14:30'` no fuso da unidade → instante UTC. */
export function zonedDateTime(isoDate: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  const [hh, mi] = hhmm.split(':').map(Number)
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`data inválida: ${isoDate}`)
  }
  if (hh === undefined || mi === undefined) throw new Error(`hora inválida: ${hhmm}`)
  return zonedToUtc(y, m, d, hh, mi, timeZone)
}

/** Instante UTC → `'2026-08-10'` no fuso indicado. */
export function isoDateInZone(instant: Date, timeZone: string): string {
  const p = toZonedParts(instant, timeZone)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Instante UTC → `'14:30'` no fuso indicado. */
export function isoTimeInZone(instant: Date, timeZone: string): string {
  const p = toZonedParts(instant, timeZone)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** 0 = domingo … 6 = sábado, no fuso indicado. */
export function weekdayInZone(instant: Date, timeZone: string): number {
  return toZonedParts(instant, timeZone).weekday
}

/** Soma dias em cima da data de parede — imune a virada de horário de verão. */
export function addDaysInZone(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`data inválida: ${isoDate}`)
  }
  const shifted = new Date(Date.UTC(y, m - 1, d + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

/** 0 = domingo … 6 = sábado, para uma data de parede. */
export function weekdayOfIsoDate(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`data inválida: ${isoDate}`)
  }
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * `'2026-08-10'` — a data de parede que existe, e não só a que tem a forma certa.
 *
 * A conferência do calendário é a metade que faltava nas três cópias locais que
 * esta função substituiu, todas elas só `/^\d{4}-\d{2}-\d{2}$/`. Esse teste
 * aceita `2026-02-31`, e daí para a frente `Date.UTC` rola calado para 3 de
 * março: a agenda abria com a data da URL escrita no cabeçalho e os
 * atendimentos de outro dia por baixo. Um `?d=` vem da barra de endereço, de um
 * favorito antigo ou de um link colado no WhatsApp — nunca só do seletor.
 */
export function isIsoDate(value: string | undefined | null): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return false
  const instante = new Date(Date.UTC(y, m - 1, d))
  return (
    instante.getUTCFullYear() === y &&
    instante.getUTCMonth() === m - 1 &&
    instante.getUTCDate() === d
  )
}
