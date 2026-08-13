import 'server-only'

/**
 * A agenda de uma pessoa, ao longo do tempo.
 *
 * ── Por que isto não existia ──────────────────────────────────────────────
 * O sistema só sabia responder "o que acontece nesta LOJA, neste DIA" — a
 * grade da recepção, uma coluna por profissional. A profissional que quisesse
 * saber como estava a semana dela abria a grade sete vezes e lia a própria
 * coluna em cada uma. Se trabalhasse em duas casas, catorze vezes, e ainda
 * tinha de somar de cabeça.
 *
 * A pergunta certa dela é outra: "o que vou fazer, onde e com quem — hoje, esta
 * semana, este mês". Este arquivo responde a essa, e o eixo é a pessoa, não a
 * loja. As casas entram como coluna do resultado, porque quem atende em duas
 * precisa de saber em qual estará na quinta.
 *
 * ── Uma nota sobre o recorte ──────────────────────────────────────────────
 * O filtro do banco é por instante, alargado num dia para cada lado; o recorte
 * fino é por data de parede, já com o fuso de cada casa. É o que faz duas lojas
 * em fusos diferentes caberem na mesma consulta sem que uma delas perca a
 * primeira ou a última marcação do período.
 */

import {
  appointmentItems,
  appointments,
  clientProfiles,
  services,
  units,
  users,
} from '@studio/db'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import type { AppointmentStatus } from './queries'

export interface Compromisso {
  appointmentId: string
  /** Data de parede na casa, `YYYY-MM-DD`. É por ela que a tela agrupa. */
  data: string
  inicio: Date
  fim: Date
  /** "14:30" e "16:00" na casa — a tela não recebe fuso. */
  hora: string
  horaFim: string
  clienteId: string
  clienteNome: string
  clienteTelefone: string
  unidadeNome: string
  unidadeSlug: string
  timezone: string
  status: AppointmentStatus
  /** Só os serviços que ESTA pessoa executa nesta visita. */
  servicos: string[]
  /** Soma das linhas desta pessoa, em cêntimos — não o total da visita. */
  valor: number
  duracaoMin: number
}

/** Estados que já não ocupam a agenda de ninguém. */
const MORTOS = new Set<AppointmentStatus>([
  'cancelled_by_client',
  'cancelled_by_studio',
  'no_show',
])

export async function agendaDoProfissional(
  staffId: string,
  deData: string,
  ateData: string,
  opcoes: { incluirCancelados?: boolean } = {},
): Promise<Compromisso[]> {
  /* Um dia de folga para cada lado cobre a diferença de fuso entre casas sem
     precisar de uma consulta por loja. O recorte exacto é feito abaixo. */
  const inicio = new Date(`${deData}T00:00:00Z`)
  inicio.setUTCDate(inicio.getUTCDate() - 1)
  const fim = new Date(`${ateData}T00:00:00Z`)
  fim.setUTCDate(fim.getUTCDate() + 2)

  const linhas = await db
    .select({
      appointmentId: appointmentItems.appointmentId,
      inicio: appointmentItems.startsAt,
      fim: appointmentItems.endsAt,
      preco: appointmentItems.price,
      duracaoMin: appointmentItems.durationMin,
      servico: services.name,
      status: appointments.status,
      clienteId: appointments.clientId,
      clienteNome: users.name,
      clienteTelefone: users.phone,
      unidadeNome: units.name,
      unidadeSlug: units.slug,
      timezone: units.timezone,
    })
    .from(appointmentItems)
    .innerJoin(appointments, eq(appointments.id, appointmentItems.appointmentId))
    .innerJoin(units, eq(units.id, appointments.unitId))
    .innerJoin(services, eq(services.id, appointmentItems.serviceId))
    .innerJoin(clientProfiles, eq(clientProfiles.id, appointments.clientId))
    .innerJoin(users, eq(users.id, clientProfiles.userId))
    .where(
      and(
        eq(appointmentItems.staffId, staffId),
        gte(appointmentItems.startsAt, inicio),
        lt(appointmentItems.startsAt, fim),
      ),
    )
    .orderBy(asc(appointmentItems.startsAt), asc(appointmentItems.sortOrder))

  /*
    Uma visita pode ter duas linhas com a mesma pessoa (lavar + cortar). Na
    agenda dela isso é UM compromisso, do início da primeira ao fim da última —
    duas fichas seguidas com o mesmo nome fariam a manhã parecer o dobro do que é.
  */
  const porVisita = new Map<string, Compromisso>()

  for (const linha of linhas) {
    if (!opcoes.incluirCancelados && MORTOS.has(linha.status)) continue

    const data = paredeData(linha.inicio, linha.timezone)
    if (data < deData || data > ateData) continue

    const existente = porVisita.get(linha.appointmentId)
    if (existente) {
      existente.servicos.push(linha.servico)
      existente.valor += linha.preco
      existente.duracaoMin += linha.duracaoMin
      if (linha.fim > existente.fim) {
        existente.fim = linha.fim
        existente.horaFim = paredeHora(linha.fim, linha.timezone)
      }
      continue
    }

    porVisita.set(linha.appointmentId, {
      appointmentId: linha.appointmentId,
      data,
      inicio: linha.inicio,
      fim: linha.fim,
      hora: paredeHora(linha.inicio, linha.timezone),
      horaFim: paredeHora(linha.fim, linha.timezone),
      clienteId: linha.clienteId,
      clienteNome: linha.clienteNome,
      clienteTelefone: linha.clienteTelefone,
      unidadeNome: linha.unidadeNome,
      unidadeSlug: linha.unidadeSlug,
      timezone: linha.timezone,
      status: linha.status,
      servicos: [linha.servico],
      valor: linha.preco,
      duracaoMin: linha.duracaoMin,
    })
  }

  return [...porVisita.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
}

export interface ResumoPeriodo {
  visitas: number
  /** Em cêntimos, só as linhas desta pessoa. */
  valor: number
  minutos: number
  /** Quantas já foram dadas por concluídas. */
  concluidas: number
}

export function resumir(lista: readonly Compromisso[]): ResumoPeriodo {
  let resumo: ResumoPeriodo = { visitas: 0, valor: 0, minutos: 0, concluidas: 0 }
  for (const item of lista) {
    resumo.visitas += 1
    resumo.valor += item.valor
    resumo.minutos += item.duracaoMin
    if (item.status === 'completed') resumo.concluidas += 1
  }
  return resumo
}

/** `en-CA` devolve `YYYY-MM-DD`, que é o formato que o resto do sistema usa. */
function paredeData(instante: Date, timezone: string): string {
  return instante.toLocaleDateString('en-CA', { timeZone: timezone })
}

function paredeHora(instante: Date, timezone: string): string {
  return instante.toLocaleTimeString('pt-PT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  })
}
