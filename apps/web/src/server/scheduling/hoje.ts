import 'server-only'

/**
 * A porta: a loja está aberta agora?
 *
 * Fica separado do contexto de disponibilidade de propósito. Aquele monta a
 * grade de horários de um período inteiro e é caro; isto responde uma pergunta
 * de vitrine, com duas consultas, para a tela que a cliente vê primeiro.
 *
 * O estado `sem-horario` é o motivo de este arquivo existir. Uma loja acabada
 * de cadastrar não tem horário nenhum, e dizer "Fechada" nesse caso é mentir
 * com cara de informação: a cliente desiste de uma loja que estava aberta. Sem
 * horário, a vitrine não fala de horário.
 */

import { isoDateInZone, weekdayInZone, zonedDateTime } from '@studio/core'
import { unitExceptions, unitHours } from '@studio/db'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { UnitInfo } from './context'

export type EstadoDaPorta =
  | { tipo: 'aberta'; ate: string }
  | { tipo: 'abre-hoje'; as: string }
  | { tipo: 'fechada-hoje' }
  /** Nenhum horário cadastrado. Não é o mesmo que fechada. */
  | { tipo: 'sem-horario' }

export interface HojeNaLoja {
  /** Janelas de hoje, `HH:MM` no fuso da unidade. Duas quando há pausa. */
  janelas: { abre: string; fecha: string }[]
  estado: EstadoDaPorta
  /** Verdadeiro quando o horário de hoje veio de uma exceção (feriado, ponte). */
  excecao: boolean
}

const hhmm = (raw: string) => raw.slice(0, 5)

/**
 * Uma consulta para todas as unidades — a vitrine mostra várias lado a lado, e
 * uma consulta por loja transformaria a primeira tela do agendamento numa fila
 * de idas ao banco.
 */
export async function portaDasUnidades(
  unidades: readonly UnitInfo[],
  agora = new Date(),
): Promise<Map<string, HojeNaLoja>> {
  const resultado = new Map<string, HojeNaLoja>()
  if (unidades.length === 0) return resultado

  const ids = unidades.map((u) => u.id)
  /* As datas de "hoje" podem diferir entre unidades de fusos diferentes — a
     consulta pega todas as candidatas de uma vez e o filtro fino é por loja. */
  const datas = [...new Set(unidades.map((u) => isoDateInZone(agora, u.timezone)))]

  const [horarios, excecoes] = await Promise.all([
    db.select().from(unitHours).where(inArray(unitHours.unitId, ids)),
    db
      .select()
      .from(unitExceptions)
      .where(and(inArray(unitExceptions.unitId, ids), inArray(unitExceptions.date, datas))),
  ])

  for (const unidade of unidades) {
    resultado.set(
      unidade.id,
      portaDeUma(
        unidade,
        agora,
        horarios.filter((h) => h.unitId === unidade.id),
        excecoes.filter((e) => e.unitId === unidade.id),
      ),
    )
  }
  return resultado
}

export async function portaDaUnidade(unidade: UnitInfo, agora = new Date()): Promise<HojeNaLoja> {
  const hoje = isoDateInZone(agora, unidade.timezone)
  const [horarios, excecoes] = await Promise.all([
    db.select().from(unitHours).where(eq(unitHours.unitId, unidade.id)),
    db
      .select()
      .from(unitExceptions)
      .where(and(eq(unitExceptions.unitId, unidade.id), eq(unitExceptions.date, hoje))),
  ])
  return portaDeUma(unidade, agora, horarios, excecoes)
}

function portaDeUma(
  unidade: UnitInfo,
  agora: Date,
  horarios: (typeof unitHours.$inferSelect)[],
  excecoes: (typeof unitExceptions.$inferSelect)[],
): HojeNaLoja {
  /* Sem uma linha sequer para a semana inteira, a loja não declarou horário.
     Sem nenhuma para HOJE, ela declarou e hoje é dia de folga — coisas
     diferentes, e a tela diz coisas diferentes. */
  if (horarios.length === 0) {
    return { janelas: [], estado: { tipo: 'sem-horario' }, excecao: false }
  }

  const hoje = isoDateInZone(agora, unidade.timezone)
  const doDia = excecoes.filter((e) => e.date === hoje)

  let janelas: { abre: string; fecha: string }[]
  let excecao = false

  if (doDia.length > 0) {
    excecao = true
    // uma linha de "fechado" vence qualquer outra do mesmo dia
    janelas = doDia.some((e) => e.closed)
      ? []
      : doDia
          .filter((e) => e.opensAt && e.closesAt)
          .map((e) => ({ abre: hhmm(e.opensAt!), fecha: hhmm(e.closesAt!) }))
  } else {
    const weekday = weekdayInZone(agora, unidade.timezone)
    janelas = horarios
      .filter((h) => h.weekday === weekday)
      .map((h) => ({ abre: hhmm(h.opensAt), fecha: hhmm(h.closesAt) }))
  }

  janelas.sort((a, b) => a.abre.localeCompare(b.abre))
  if (janelas.length === 0) {
    return { janelas, estado: { tipo: 'fechada-hoje' }, excecao }
  }

  for (const janela of janelas) {
    const abre = zonedDateTime(hoje, janela.abre, unidade.timezone)
    const fecha = zonedDateTime(hoje, janela.fecha, unidade.timezone)
    if (agora >= abre && agora < fecha) {
      return { janelas, estado: { tipo: 'aberta', ate: janela.fecha }, excecao }
    }
    if (agora < abre) {
      return { janelas, estado: { tipo: 'abre-hoje', as: janela.abre }, excecao }
    }
  }

  return { janelas, estado: { tipo: 'fechada-hoje' }, excecao }
}

/** O que a vitrine escreve. `null` quando não há o que dizer com honestidade. */
export function frasePorta(estado: EstadoDaPorta): string | null {
  switch (estado.tipo) {
    case 'aberta':
      return `Aberto até às ${estado.ate}`
    case 'abre-hoje':
      return `Abre hoje às ${estado.as}`
    case 'fechada-hoje':
      return 'Hoje não abre'
    case 'sem-horario':
      return null
  }
}
