/**
 * Aleatoriedade determinística.
 *
 * O seed precisa gerar a mesma agenda toda vez: é ambiente de demonstração e
 * base de teste de integração. Agenda que muda a cada `db:seed` transforma
 * qualquer bug em "na minha máquina era diferente".
 */
export class Rng {
  private state: number

  constructor(seed = 20260804) {
    this.state = seed >>> 0
  }

  /** mulberry32 — pequeno, rápido e suficiente para dado de demonstração. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Inteiro em [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick em lista vazia')
    return items[Math.floor(this.next() * items.length)] as T
  }

  /** Escolhe por peso relativo. Peso zero nunca sai. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((sum, [, w]) => sum + w, 0)
    let roll = this.next() * total
    for (const [item, weight] of items) {
      roll -= weight
      if (roll < 0) return item
    }
    return items[items.length - 1]![0]
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
    }
    return copy
  }
}
