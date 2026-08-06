import 'server-only'

/**
 * A fila de avisos do dia.
 *
 * O ponto de projeto que importa aqui: **não existe agendador**. Nada acorda às
 * três da manhã para "gerar" os avisos de amanhã. A fila é uma *consulta* —
 * "quem atende amanhã e ainda não tem registro de lembrete" —, então ela está
 * sempre certa no instante em que a recepção abre a tela, sem worker, sem fila
 * de jobs e sem estado para sair de sincronia.
 *
 * O que impede o aviso duplicado é o próprio `notification_logs`: cada linha é
 * a prova de que aquele par (agendamento, rotina) já foi tratado. Enviar é
 * gravar; gravar é sair da fila.
 */

import { addDaysInZone, isoDateInZone, zonedDateTime } from '@studio/core'
import {
  appointmentItems,
  appointments,
  clientProfiles,
  notificationLogs,
  services,
  staffProfiles,
  users,
} from '@studio/db'
import { and, asc, count, eq, gt, gte, inArray, lt, notExists, notInArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { formatDateLong, formatTime } from '@/lib/format'
import type { UnitInfo } from '../scheduling/context'
import { todayInUnit } from '../scheduling/availability'
import { ROUTINES, renderMessage, whatsappLink, type RoutineKey } from './templates'

/** Agendamento que não conta mais como compromisso vivo. */
const CANCELLED = ['cancelled_by_client', 'cancelled_by_studio', 'no_show'] as const

/** Quanto tempo para trás a rotina de resgate olha. */
const RESGATE_DIAS = 7

export interface Notice {
  /** Identidade da linha na fila: agendamento + rotina. */
  appointmentId: string
  routine: RoutineKey
  clientId: string
  clientName: string
  clientPhone: string
  /** Quando o atendimento acontece (ou aconteceu). */
  start: Date
  /** "Corte feminino + Escova", já pronto para o texto. */
  services: string
  staffName: string
  /** Mensagem final, com as variáveis já trocadas. */
  message: string
  /** `wa.me` com o texto embutido. */
  link: string
}

interface Row {
  appointmentId: string
  clientId: string
  clientName: string
  clientPhone: string
  start: Date
}

/**
 * Janela de cada rotina, em horário de parede da unidade.
 * `hoje` é a data local da unidade, não do servidor — o salão pode estar em
 * fuso diferente de onde isto roda.
 */
function windowFor(routine: RoutineKey, unit: UnitInfo, now: Date) {
  const hoje = todayInUnit(unit, now)
  const inicioDeHoje = zonedDateTime(hoje, '00:00', unit.timezone)
  const inicioDeAmanha = zonedDateTime(addDaysInZone(hoje, 1), '00:00', unit.timezone)
  const inicioDeDepoisDeAmanha = zonedDateTime(addDaysInZone(hoje, 2), '00:00', unit.timezone)
  const inicioDeOntem = zonedDateTime(addDaysInZone(hoje, -1), '00:00', unit.timezone)

  switch (routine) {
    // Marcou e ainda não ouviu nada. Vale para qualquer atendimento futuro —
    // inclusive o de daqui a três semanas, que é justamente o que dá mais
    // insegurança em quem marcou sozinha às onze da noite.
    case 'confirmacao':
      return { from: now, to: null, cancelled: false }

    case 'lembrete_vespera':
      return { from: inicioDeAmanha, to: inicioDeDepoisDeAmanha, cancelled: false }

    // Hoje, e que ainda não começou: avisar de horário que já passou é ruído.
    case 'bom_dia':
      return { from: now, to: inicioDeAmanha, cancelled: false }

    case 'avaliacao':
      return { from: inicioDeOntem, to: inicioDeHoje, cancelled: false }

    case 'resgate':
      return {
        from: zonedDateTime(addDaysInZone(hoje, -RESGATE_DIAS), '00:00', unit.timezone),
        to: inicioDeHoje,
        cancelled: true,
      }
  }
}

/**
 * O filtro que define quem está na fila de uma rotina.
 *
 * O `notExists` é o anti-duplicata: se já existe registro daquele agendamento
 * com aquela rotina, a pessoa não aparece de novo — nem depois de recarregar a
 * página, nem se duas recepcionistas abrirem a tela ao mesmo tempo.
 *
 * Fica separado da leitura porque a contagem das abas usa o mesmo filtro sem
 * precisar de nome, serviço nem mensagem montada.
 */
function conditionsFor(unit: UnitInfo, routine: RoutineKey, now: Date) {
  const janela = windowFor(routine, unit, now)

  return [
    eq(appointments.unitId, unit.id),
    gte(appointments.startsAt, janela.from),
    ...(janela.to ? [lt(appointments.startsAt, janela.to)] : []),
    // Avaliação só faz sentido para quem de fato foi atendida.
    ...(routine === 'avaliacao' ? [eq(appointments.status, 'completed')] : []),
    /*
      Confirmação é só para quem marcou sozinha pelo site. Quem marcou pelo
      balcão, pelo telefone ou pelo WhatsApp já falou com uma pessoa e já ouviu
      "tá marcado" — mandar de novo é o sistema não sabendo o que a recepção
      acabou de fazer, e é assim que a fila perde a confiança de quem usa.
    */
    ...(routine === 'confirmacao' ? [eq(appointments.source, 'client_app')] : []),
    janela.cancelled
      ? inArray(appointments.status, [...CANCELLED])
      : notInArray(appointments.status, [...CANCELLED]),
    notExists(
      db
        .select({ um: sql`1` })
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.refType, 'appointment'),
            eq(notificationLogs.refId, appointments.id),
            eq(notificationLogs.templateKey, routine),
          ),
        ),
    ),
  ]
}

/** A fila de uma rotina, já com a mensagem escrita e o link pronto. */
export async function listNotices(
  unit: UnitInfo,
  routine: RoutineKey,
  now = new Date(),
): Promise<Notice[]> {
  const rows: Row[] = await db
    .select({
      appointmentId: appointments.id,
      clientId: appointments.clientId,
      clientName: users.name,
      clientPhone: users.phone,
      start: appointments.startsAt,
    })
    .from(appointments)
    .innerJoin(clientProfiles, eq(clientProfiles.id, appointments.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(and(...conditionsFor(unit, routine, now)))
    .orderBy(asc(appointments.startsAt))
    .limit(200)

  if (rows.length === 0) return []

  const detalhes = await servicesByAppointment(rows.map((row) => row.appointmentId))

  return rows.map((row) => {
    const detalhe = detalhes.get(row.appointmentId)
    const vars = {
      cliente: primeiroNome(row.clientName),
      servicos: detalhe?.services ?? 'seu atendimento',
      profissional: detalhe?.staffName ?? 'a equipe',
      data: formatDateLong(isoDateInZone(row.start, unit.timezone)),
      hora: formatTime(row.start, unit.timezone),
      unidade: unit.name,
      endereco: [unit.addressLine, unit.district].filter(Boolean).join(' — '),
    }
    const message = renderMessage(routine, vars)

    return {
      ...row,
      routine,
      services: detalhe?.services ?? '—',
      staffName: detalhe?.staffName ?? '—',
      message,
      link: whatsappLink(row.clientPhone, message),
    }
  })
}

/** Serviços e profissional de cada agendamento, numa consulta só. */
async function servicesByAppointment(
  ids: readonly string[],
): Promise<Map<string, { services: string; staffName: string }>> {
  const rows = await db
    .select({
      appointmentId: appointmentItems.appointmentId,
      serviceName: services.name,
      staffName: staffProfiles.displayName,
    })
    .from(appointmentItems)
    .innerJoin(services, eq(services.id, appointmentItems.serviceId))
    .innerJoin(staffProfiles, eq(staffProfiles.id, appointmentItems.staffId))
    .where(inArray(appointmentItems.appointmentId, [...ids]))
    .orderBy(asc(appointmentItems.sortOrder))

  const mapa = new Map<string, { services: string[]; staffName: string }>()
  for (const row of rows) {
    const atual = mapa.get(row.appointmentId) ?? { services: [], staffName: row.staffName }
    atual.services.push(row.serviceName)
    mapa.set(row.appointmentId, atual)
  }

  return new Map(
    [...mapa].map(([id, valor]) => [
      id,
      { services: valor.services.join(' + '), staffName: valor.staffName },
    ]),
  )
}

/**
 * Quantos avisos pendentes em cada rotina — alimenta as abas.
 *
 * Conta sem montar mensagem: a aba só precisa do número, e montar cinco filas
 * inteiras para descartar quatro seria pagar o join de serviços cinco vezes a
 * cada abertura da tela.
 */
export async function countNotices(
  unit: UnitInfo,
  now = new Date(),
): Promise<Record<RoutineKey, number>> {
  const chaves = ROUTINES.map((rotina) => rotina.key)

  const totais = await Promise.all(
    chaves.map(async (chave) => {
      const [linha] = await db
        .select({ n: count() })
        .from(appointments)
        .where(and(...conditionsFor(unit, chave, now)))
      return linha?.n ?? 0
    }),
  )

  return Object.fromEntries(chaves.map((chave, i) => [chave, totais[i]!])) as Record<
    RoutineKey,
    number
  >
}

/** "Marina Souza Prado" → "Marina". Mensagem de salão trata pelo primeiro nome. */
function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}

// ─── suprimir avisos vencidos ───────────────────────────────────────────────

/**
 * Fecha as janelas que passaram sem ninguém clicar.
 *
 * Sem isto, o lembrete de véspera de ontem continuaria pendente para sempre e a
 * fila viraria um cemitério — que é como toda caixa de entrada de tarefa morre.
 * Roda junto com a leitura da tela; é barato e mantém a fila honesta.
 */
export async function expireStaleNotices(unit: UnitInfo, now = new Date()): Promise<number> {
  const hoje = todayInUnit(unit, now)
  const inicioDeHoje = zonedDateTime(hoje, '00:00', unit.timezone)

  const vencidos = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.unitId, unit.id),
        lt(appointments.startsAt, inicioDeHoje),
        gt(appointments.startsAt, new Date(inicioDeHoje.getTime() - 30 * 24 * 3600_000)),
        notExists(
          db
            .select({ um: sql`1` })
            .from(notificationLogs)
            .where(
              and(
                eq(notificationLogs.refType, 'appointment'),
                eq(notificationLogs.refId, appointments.id),
                eq(notificationLogs.templateKey, 'lembrete_vespera'),
              ),
            ),
        ),
      ),
    )
    .limit(500)

  if (vencidos.length === 0) return 0

  await db.insert(notificationLogs).values(
    vencidos.map((linha) => ({
      channel: 'whatsapp' as const,
      templateKey: 'lembrete_vespera',
      refType: 'appointment',
      refId: linha.id,
      status: 'cancelled' as const,
      error: 'janela do aviso passou sem envio',
    })),
  )

  return vencidos.length
}
