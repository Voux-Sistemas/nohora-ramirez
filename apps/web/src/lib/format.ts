/**
 * Formatação para o Brasil.
 *
 * Tudo que é hora recebe a timezone da unidade explicitamente: o servidor roda
 * em UTC e a recepção não pode ver 20:00 onde a cliente marcou 17:00.
 */

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Sem centavos — para números grandes de painel. */
export function formatBRLShort(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  })
}

export function formatTime(instant: Date | string, timeZone: string): string {
  return new Date(instant).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}

export function formatDateLong(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatWeekdayShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`)
    .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

/** "1h30" / "45min" — o jeito que a recepção fala. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

/** +5511998887777 → (11) 99888-7777 */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '').replace(/^55/, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return e164
}

/** Aceita o que a pessoa digitar e devolve E.164, ou null se não der. */
export function toE164(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (national.length < 10 || national.length > 11) return null
  return `+55${national}`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
