import 'server-only'

/**
 * O freio que protege a agenda de verdade.
 *
 * O limite por IP (`rate-limit.ts`) mora na memória do processo e some no
 * reinício. Este não: ele conta o que já está gravado em `appointments`, então
 * vale independente de réplica, de deploy, de IP novo e de aba nova. Trocar de
 * rede não ajuda quem está do outro lado — o telefone é o mesmo, e é por ele
 * que a conta é feita.
 *
 * Os tetos são folgados de propósito. Mãe marcando para as duas filhas no mesmo
 * telefone é comportamento real e não pode esbarrar em nada; quem precisa
 * esbarrar é o script, que faz centenas. O limite existe para separar essas
 * duas coisas, não para disciplinar cliente.
 */

import { LIVE_APPOINTMENT_STATUSES, appointments } from '@studio/db'
import { and, count, eq, gt, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'

/** Quantos agendamentos o mesmo telefone pode criar numa hora. */
const POR_HORA = 5

/** Quantos compromissos futuros o mesmo telefone pode manter em aberto. */
const FUTUROS_EM_ABERTO = 12

export interface GuardVerdict {
  ok: boolean
  message?: string
}

const LIBERADO: GuardVerdict = { ok: true }

export async function checkBookingQuota(clientId: string): Promise<GuardVerdict> {
  const agora = new Date()
  const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000)

  const [recentes, emAberto] = await Promise.all([
    db
      .select({ n: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clientId, clientId),
          gte(appointments.createdAt, umaHoraAtras),
          eq(appointments.source, 'client_app'),
        ),
      ),
    db
      .select({ n: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.clientId, clientId),
          gt(appointments.startsAt, agora),
          inArray(appointments.status, [...LIVE_APPOINTMENT_STATUSES]),
        ),
      ),
  ])

  /*
   * As duas mensagens dizem o que fazer e mandam falar com o salão. Recusa sem
   * saída manda cliente de verdade embora, e cliente de verdade é quem lê isto
   * — o script não lê nada.
   */
  if ((recentes[0]?.n ?? 0) >= POR_HORA) {
    return {
      ok: false,
      message:
        'Você marcou vários horários agora há pouco. Espere um pouco ou fale com a recepção pelo WhatsApp.',
    }
  }

  if ((emAberto[0]?.n ?? 0) >= FUTUROS_EM_ABERTO) {
    return {
      ok: false,
      message:
        'Você já tem muitos horários marcados. Fale com a recepção para organizar sua agenda.',
    }
  }

  return LIBERADO
}
