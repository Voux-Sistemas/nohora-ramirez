/**
 * Utilitários de intervalo de tempo.
 *
 * Convenção do projeto: todo intervalo é semiaberto — `[start, end)`.
 * Dois intervalos que apenas se tocam (`a.end === b.start`) NÃO se sobrepõem.
 * É isso que permite encostar dois atendimentos sem falso conflito.
 */

export interface TimeRange {
  readonly start: Date
  readonly end: Date
}

export const MINUTE_MS = 60_000

export function minutes(n: number): number {
  return n * MINUTE_MS
}

export function addMinutes(date: Date, min: number): Date {
  return new Date(date.getTime() + min * MINUTE_MS)
}

export function durationMin(range: TimeRange): number {
  return (range.end.getTime() - range.start.getTime()) / MINUTE_MS
}

export function isValidRange(range: TimeRange): boolean {
  return range.end.getTime() > range.start.getTime()
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

export function contains(outer: TimeRange, inner: TimeRange): boolean {
  return (
    outer.start.getTime() <= inner.start.getTime() &&
    inner.end.getTime() <= outer.end.getTime()
  )
}

export function overlapsAny(range: TimeRange, others: readonly TimeRange[]): boolean {
  return others.some((other) => overlaps(range, other))
}

/** Verdadeiro se o intervalo cabe inteiro dentro de ao menos uma das janelas. */
export function containedInAny(range: TimeRange, windows: readonly TimeRange[]): boolean {
  return windows.some((window) => contains(window, range))
}

/**
 * Ordena e funde intervalos que se sobrepõem ou se tocam.
 * Intervalos vazios ou inválidos são descartados.
 */
export function mergeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const valid = ranges.filter(isValidRange)
  if (valid.length === 0) return []

  const sorted = [...valid].sort((a, b) => a.start.getTime() - b.start.getTime())
  const merged: TimeRange[] = []

  let current = sorted[0]!
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!
    if (next.start.getTime() <= current.end.getTime()) {
      // sobrepõe ou encosta → funde
      if (next.end.getTime() > current.end.getTime()) {
        current = { start: current.start, end: next.end }
      }
    } else {
      merged.push(current)
      current = next
    }
  }
  merged.push(current)
  return merged
}

/**
 * Remove `cuts` de `base`, devolvendo o que sobrou.
 * Usado para transformar "escala do profissional" em "janelas realmente livres".
 */
export function subtractRanges(
  base: readonly TimeRange[],
  cuts: readonly TimeRange[],
): TimeRange[] {
  const normalizedCuts = mergeRanges(cuts)
  let result = mergeRanges(base)

  for (const cut of normalizedCuts) {
    const next: TimeRange[] = []
    for (const range of result) {
      if (!overlaps(range, cut)) {
        next.push(range)
        continue
      }
      // pedaço à esquerda do corte
      if (range.start.getTime() < cut.start.getTime()) {
        next.push({ start: range.start, end: cut.start })
      }
      // pedaço à direita do corte
      if (cut.end.getTime() < range.end.getTime()) {
        next.push({ start: cut.end, end: range.end })
      }
    }
    result = next
  }

  return result.filter(isValidRange)
}

/** Interseção de duas listas de intervalos. */
export function intersectRanges(
  a: readonly TimeRange[],
  b: readonly TimeRange[],
): TimeRange[] {
  const left = mergeRanges(a)
  const right = mergeRanges(b)
  const result: TimeRange[] = []

  for (const l of left) {
    for (const r of right) {
      const start = Math.max(l.start.getTime(), r.start.getTime())
      const end = Math.min(l.end.getTime(), r.end.getTime())
      if (end > start) result.push({ start: new Date(start), end: new Date(end) })
    }
  }

  return mergeRanges(result)
}

/** Total em minutos coberto por uma lista de intervalos (já descontando sobreposição). */
export function totalMinutes(ranges: readonly TimeRange[]): number {
  return mergeRanges(ranges).reduce((sum, range) => sum + durationMin(range), 0)
}
