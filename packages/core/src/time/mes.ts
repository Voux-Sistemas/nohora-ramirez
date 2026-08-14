/**
 * A janela do mês corrente e o mesmo trecho do mês anterior.
 *
 * ── Por que "o mesmo trecho" ──────────────────────────────────────────────
 * Comparar um mês corrente pela metade com um mês anterior inteiro faz o mês
 * corrente parecer sempre murcho — dia 13 contra 31 dias fechados. O corte usa
 * a mesma contagem de dias (dia 13 deste mês contra os primeiros 13 do mês
 * passado) e autolimita-se ao início do mês corrente quando o mês anterior é
 * mais curto: dia 31 de janeiro comparado com um fevereiro de 28 dias pararia
 * em 3 de março se ninguém segurasse.
 *
 * ── Por que vive aqui, e não na página ────────────────────────────────────
 * Esta conta estava escrita duas vezes, palavra por palavra, em `/` e em
 * `/admin` — as duas telas que respondem "como vai o mês". Duas cópias de uma
 * regra de comparação é uma que se corrige e outra que fica errada. Aqui ela é
 * uma só, e tem teste.
 */

import { addDaysInZone, isoDateInZone, zonedDateTime } from './timezone.js'

export interface JanelaDoMes {
  /** Dia de hoje dentro do mês, no fuso pedido (1–31). */
  readonly diaDoMes: number
  /** Quantos dias tem o mês corrente — o tamanho da série dia a dia. */
  readonly dias: number
  /** `'2026-08-01'`, para rotular o mês. */
  readonly inicioIso: string
  readonly inicio: Date
  /** Exclusivo: a meia-noite que abre o mês seguinte. */
  readonly fim: Date
  readonly anteriorInicio: Date
  /**
   * Os mesmos quatro limites como texto ISO em UTC.
   *
   * Construtores de SQL que interpolam valor cru — `filter (where …)`, por
   * exemplo — não passam pelo mapeamento de tipo da coluna e entregam o `Date`
   * ao driver tal como está, que rebenta ao serializar o pacote ("must be of
   * type string or an instance of Buffer"). Quem escreve esses trechos usa
   * estas, não as de cima.
   */
  readonly inicioTs: string
  readonly fimTs: string
  readonly anteriorInicioTs: string
  readonly anteriorFimTs: string
}

export function janelaDoMes(instante: Date, timeZone: string): JanelaDoMes {
  const hoje = isoDateInZone(instante, timeZone)
  const [ano, mes, diaDoMes] = hoje.split('-').map(Number) as [number, number, number]

  const inicioIso = `${ano}-${pad2(mes)}-01`
  const [proxAno, proxMes] = mes === 12 ? [ano + 1, 1] : [ano, mes + 1]
  const fimIso = `${proxAno}-${pad2(proxMes)}-01`
  const [antAno, antMes] = mes === 1 ? [ano - 1, 12] : [ano, mes - 1]
  const anteriorInicioIso = `${antAno}-${pad2(antMes)}-01`

  const corte = addDaysInZone(anteriorInicioIso, diaDoMes)
  const anteriorFimIso = corte < inicioIso ? corte : inicioIso

  const inicio = zonedDateTime(inicioIso, '00:00', timeZone)
  const fim = zonedDateTime(fimIso, '00:00', timeZone)
  const anteriorInicio = zonedDateTime(anteriorInicioIso, '00:00', timeZone)
  const anteriorFim = zonedDateTime(anteriorFimIso, '00:00', timeZone)

  return {
    diaDoMes,
    // dia 0 do mês seguinte é o último dia deste mês
    dias: new Date(Date.UTC(proxAno, proxMes - 1, 0)).getUTCDate(),
    inicioIso,
    inicio,
    fim,
    anteriorInicio,
    inicioTs: inicio.toISOString(),
    fimTs: fim.toISOString(),
    anteriorInicioTs: anteriorInicio.toISOString(),
    anteriorFimTs: anteriorFim.toISOString(),
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Agrupa lojas pelo fuso, para que os agregados sejam uma consulta por fuso
 * distinto e não uma por loja.
 *
 * Hoje devolve sempre um grupo só — a rede está toda em Portugal —, e é por
 * isso que existe: sem ele o caminho óbvio é o laço por unidade, que já foi o
 * que estava escrito e fazia N consultas para responder a uma pergunta. A rede
 * que um dia abrir noutro fuso continua a somar certo sem ninguém mexer aqui.
 */
export function agruparPorFuso<T extends { timezone: string }>(itens: readonly T[]): Map<string, T[]> {
  const grupos = new Map<string, T[]>()
  for (const item of itens) {
    const grupo = grupos.get(item.timezone)
    if (grupo) grupo.push(item)
    else grupos.set(item.timezone, [item])
  }
  return grupos
}
