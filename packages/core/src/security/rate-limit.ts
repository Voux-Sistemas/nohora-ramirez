/**
 * Janela deslizante de acertos.
 *
 * Deslizante, e não janela fixa, porque janela fixa deixa passar o dobro na
 * virada — seis acertos no fim de uma janela e seis no começo da seguinte são
 * doze em poucos segundos. É exatamente por esse buraco que um script entra.
 *
 * Guarda os instantes em memória. Serve para barrar volume — o script que
 * dispara centenas de vezes por minuto —, não para contabilidade durável. Quem
 * precisa sobreviver a reinício conta no banco, não aqui.
 */

export interface Rule {
  /** Quantos acertos cabem na janela. */
  limit: number
  /** Tamanho da janela, em segundos. */
  windowSec: number
}

export interface Verdict {
  ok: boolean
  /** Segundos até liberar. Zero quando `ok`. */
  retryAfterSec: number
}

export interface RateLimiter {
  /** Registra uma tentativa e diz se ela passa. */
  hit(key: string, rule: Rule, now?: number): Verdict
  /** Devolve o último acerto de uma chave — para tentativa que deu certo. */
  forgive(key: string): void
  /** Quantas chaves estão vivas. Existe para teste e diagnóstico. */
  size(): number
  reset(): void
}

/** Teto de chaves vivas: passou disso, a varredura roda antes de inserir. */
const MAX_CHAVES = 10_000

/** Nada mais velho que isto influencia decisão de nenhuma regra em uso. */
const RETENCAO_MS = 15 * 60 * 1000

export function createRateLimiter(): RateLimiter {
  const acertos = new Map<string, number[]>()

  function limpar(agora: number): void {
    const corte = agora - RETENCAO_MS
    for (const [chave, instantes] of acertos) {
      const vivos = instantes.filter((instante) => instante > corte)
      if (vivos.length === 0) acertos.delete(chave)
      else acertos.set(chave, vivos)
    }
  }

  return {
    hit(key, rule, now = Date.now()) {
      const inicioDaJanela = now - rule.windowSec * 1000
      const dentro = (acertos.get(key) ?? []).filter((instante) => instante > inicioDaJanela)

      if (dentro.length >= rule.limit) {
        acertos.set(key, dentro)
        // O acerto mais antigo é o primeiro a sair da janela; é ele quem
        // define quanto falta para liberar a próxima vaga.
        const esperaMs = dentro[0]! + rule.windowSec * 1000 - now
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(esperaMs / 1000)) }
      }

      if (acertos.size >= MAX_CHAVES) limpar(now)

      dentro.push(now)
      acertos.set(key, dentro)
      return { ok: true, retryAfterSec: 0 }
    },

    forgive(key) {
      const instantes = acertos.get(key)
      if (!instantes) return
      instantes.pop()
      if (instantes.length === 0) acertos.delete(key)
    },

    size: () => acertos.size,
    reset: () => acertos.clear(),
  }
}
