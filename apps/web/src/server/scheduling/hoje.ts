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

import { addDaysInZone, isoDateInZone, weekdayInZone, zonedDateTime } from '@studio/core'
import { unitExceptions, unitHours } from '@studio/db'
import { and, eq, inArray } from 'drizzle-orm'
import { interpola, type Dicionario } from '@/i18n'
import { db } from '@/lib/db'
import type { UnitInfo } from './context'

/**
 * Quando a porta volta a abrir. `dias` conta a partir de hoje — 1 é amanhã.
 * `null` quando não há abertura nos sete dias seguintes, que é o único caso
 * em que a vitrine não promete regresso nenhum.
 */
export interface Regresso {
  dias: number
  weekday: number
  as: string
}

export type EstadoDaPorta =
  | { tipo: 'aberta'; ate: string }
  | { tipo: 'abre-hoje'; as: string }
  /** Abriu hoje e já fechou. Não é o mesmo que nunca ter aberto. */
  | { tipo: 'ja-fechou'; desde: string; regresso: Regresso | null }
  | { tipo: 'fechada-hoje'; regresso: Regresso | null }
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
     consulta pega todas as candidatas de uma vez e o filtro fino é por loja.

     Sete dias à frente e não só hoje: a frase da porta fechada diz quando ela
     volta a abrir, e prometer "abre amanhã às 09:00" na véspera de um feriado
     que está cadastrado seria mentir com cara de informação. */
  const datas = [
    ...new Set(unidades.flatMap((u) => semanaAPartirDe(isoDateInZone(agora, u.timezone)))),
  ]

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
      .where(
        and(
          eq(unitExceptions.unitId, unidade.id),
          inArray(unitExceptions.date, semanaAPartirDe(hoje)),
        ),
      ),
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
    const regresso = proximaAbertura(unidade, hoje, horarios, excecoes)
    return { janelas, estado: { tipo: 'fechada-hoje', regresso }, excecao }
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

  /* Passou por todas as janelas do dia sem estar dentro de nenhuma e sem
     nenhuma ainda por vir: abriu, e já fechou. Antes isto caía no mesmo
     `fechada-hoje` de quem nunca abriu, e às 19:58 de uma terça em que o salão
     trabalhou das 09:00 às 19:00 a montra escrevia "Hoje não abre". */
  return {
    janelas,
    estado: {
      tipo: 'ja-fechou',
      desde: janelas[janelas.length - 1]!.fecha,
      regresso: proximaAbertura(unidade, hoje, horarios, excecoes),
    },
    excecao,
  }
}

/** Hoje e os sete dias seguintes, no fuso de quem pergunta. */
function semanaAPartirDe(hoje: string): string[] {
  return Array.from({ length: 8 }, (_, i) => addDaysInZone(hoje, i))
}

/**
 * A primeira abertura depois de hoje, dentro de uma semana.
 *
 * Olha os sete dias um a um em vez de saltar para a linha semanal seguinte
 * porque uma excepção manda sobre a semana: um feriado cadastrado tira o dia
 * inteiro, e um horário especial pode abrir um dia que a semana tem fechado.
 * Uma semana é o horizonte honesto — para lá disso a resposta útil deixa de ser
 * uma hora e passa a ser um telefonema.
 */
function proximaAbertura(
  unidade: UnitInfo,
  hoje: string,
  horarios: (typeof unitHours.$inferSelect)[],
  excecoes: (typeof unitExceptions.$inferSelect)[],
): Regresso | null {
  for (let dias = 1; dias <= 7; dias++) {
    const data = addDaysInZone(hoje, dias)
    /* Meio-dia e não meia-noite: a mudança da hora legal acontece de
       madrugada, e um dia que começa às 01:00 pode nem existir. */
    const weekday = weekdayInZone(zonedDateTime(data, '12:00', unidade.timezone), unidade.timezone)

    const doDia = excecoes.filter((e) => e.date === data)
    const aberturas =
      doDia.length > 0
        ? doDia.some((e) => e.closed)
          ? []
          : doDia.filter((e) => e.opensAt).map((e) => hhmm(e.opensAt!))
        : horarios.filter((h) => h.weekday === weekday).map((h) => hhmm(h.opensAt))

    if (aberturas.length > 0) {
      aberturas.sort((a, b) => a.localeCompare(b))
      return { dias, weekday, as: aberturas[0]! }
    }
  }
  return null
}

/**
 * O que a vitrine escreve. `null` quando não há o que dizer com honestidade.
 *
 * A copy entra por parâmetro em vez de morar aqui porque a montra fala três
 * línguas e este módulo é `server-only`: manter as frases cá dentro obrigaria
 * a repetir o `switch` por idioma. A união `EstadoDaPorta` fica — o estado é
 * facto de horário, não é texto — e o dicionário só empresta as palavras.
 */
export function frasePorta(
  estado: EstadoDaPorta,
  textos: Dicionario['porta'],
  naFrase: Dicionario['dias']['naFrase'],
): string | null {
  switch (estado.tipo) {
    case 'aberta':
      return interpola(textos.aberta, { hora: estado.ate })
    case 'abre-hoje':
      return interpola(textos.abreHoje, { hora: estado.as })
    case 'ja-fechou':
      return interpola(textos.jaFechou, { hora: estado.desde }) + volta(estado.regresso, textos, naFrase)
    case 'fechada-hoje':
      return textos.fechadaHoje + volta(estado.regresso, textos, naFrase)
    case 'sem-horario':
      return null
  }
}

/* Sem regresso conhecido a frase acaba onde está: "Hoje não abre" sozinho é
   verdade, e "abre daqui a algumas semanas" não é informação. */
function volta(
  regresso: Regresso | null,
  textos: Dicionario['porta'],
  naFrase: Dicionario['dias']['naFrase'],
): string {
  if (!regresso) return ''
  const quando = regresso.dias === 1 ? textos.amanha : naFrase[regresso.weekday]!
  return interpola(textos.volta, { quando, hora: regresso.as })
}
