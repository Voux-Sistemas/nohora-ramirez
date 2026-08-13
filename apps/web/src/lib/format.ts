/**
 * Como número, data e telefone aparecem na tela.
 *
 * Nada aqui decide país — quem decide é `lib/pais.ts`. Este arquivo só aplica.
 * Foi assim que o salão português deixou de ver preço em real: uma troca de
 * variável, não uma varredura por catorze telas.
 *
 * Tudo que é hora recebe a timezone da unidade explicitamente: o servidor roda
 * em UTC e a recepção não pode ver 20:00 onde a cliente marcou 17:00.
 */

import { pais } from './pais'

export function formatMoney(cents: number): string {
  const { locale, moeda } = pais()
  return (cents / 100).toLocaleString(locale, { style: 'currency', currency: moeda })
}

/** Sem cêntimos — para números grandes de painel. */
export function formatMoneyShort(cents: number): string {
  const { locale, moeda } = pais()
  return (cents / 100).toLocaleString(locale, {
    style: 'currency',
    currency: moeda,
    maximumFractionDigits: 0,
  })
}

export function formatTime(instant: Date | string, timeZone: string): string {
  return new Date(instant).toLocaleTimeString(pais().locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}

export function formatDateLong(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(pais().locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(pais().locale, {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatWeekdayShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`)
    .toLocaleDateString(pais().locale, { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

/** "1h30" / "45min" — o jeito que a recepção fala. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

/** `+351934730344` → `934 730 344` */
export function formatPhone(e164: string): string {
  const { ddi, digitosNacionais, formatarNacional } = pais()
  const digits = e164.replace(/\D/g, '')
  const nacional = digits.startsWith(ddi) ? digits.slice(ddi.length) : digits
  /* Número de outro país (uma cliente que veio do Brasil, um registo antigo)
     sai como está. Formatar com a régua errada inventaria um número que não
     existe, e é a recepção que vai discar. */
  if (!digitosNacionais.includes(nacional.length)) return e164
  return formatarNacional(nacional)
}

/** Aceita o que a pessoa digitar e devolve E.164, ou null se não der. */
export function toE164(input: string): string | null {
  const { ddi, digitosNacionais } = pais()
  /* `00` é o prefixo de saída internacional que muita gente digita antes do
     indicativo. Não é parte de número nenhum. */
  const digits = input.replace(/\D/g, '').replace(/^00/, '')

  /*
     Tentar tirar o indicativo primeiro, mas só aceitar o que sobra se tiver
     comprimento nacional válido. No Brasil isto importa: `55998887777` é o DDD
     55 com nove dígitos, não o indicativo 55 mais um número de nove — e o teste
     de comprimento é o que separa os dois.
  */
  if (digits.startsWith(ddi)) {
    const semDdi = digits.slice(ddi.length)
    if (digitosNacionais.includes(semDdi.length)) return `+${ddi}${semDdi}`
  }
  if (digitosNacionais.includes(digits.length)) return `+${ddi}${digits}`
  return null
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}
