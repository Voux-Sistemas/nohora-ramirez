import 'server-only'

/**
 * A confirmação escrita, montada para uma marcação em concreto.
 *
 * Existe à parte de `queue.ts` porque as duas superfícies pedem a mesma coisa
 * por caminhos diferentes: a fila de avisos parte de "quem falta avisar hoje" e
 * chega às marcações; a agenda parte de UMA marcação, a que está aberta debaixo
 * do dedo da profissional, e não quer fila nenhuma. O texto e o link são os
 * mesmos — o que muda é quem pergunta.
 */

import { isoDateInZone } from '@studio/core'
import { localeDe } from '@/i18n/tipos'
import { formatDateLongEm, formatTime } from '@/lib/format'
import type { UnitInfo } from '../scheduling/context'
import type { AppointmentView } from '../scheduling/queries'
import { primeiroNome, renderMessage, whatsappLink } from './templates'

export interface DadosDeConfirmacao {
  /** `wa.me` com o texto já embutido. */
  link: string
  /** O texto, para quem quiser conferir antes de carregar. */
  mensagem: string
}

/**
 * O que a profissional vai enviar, na língua em que a cliente marcou.
 *
 * A data acompanha a língua da mensagem e a hora acompanha o fuso da loja: o
 * dia escreve-se para quem lê, mas a hora é a hora do salão — quem marcou às
 * quinze de Portugal aparece às quinze, esteja onde estiver quando ler.
 */
export function dadosDeConfirmacao(view: AppointmentView, unit: UnitInfo): DadosDeConfirmacao {
  const equipa = [...new Set(view.items.map((item) => item.staffName))]

  const mensagem = renderMessage(
    'confirmacao',
    {
      cliente: primeiroNome(view.clientName),
      servicos: view.items.map((item) => item.serviceName).join(' + '),
      /* Duas profissionais no mesmo atendimento é caso real (escova com uma,
         coloração com outra). Escrever as duas é mais honesto do que escolher
         uma — a cliente vai encontrar as duas na cadeira. */
      profissional: equipa.join(' e '),
      data: formatDateLongEm(
        isoDateInZone(view.start, unit.timezone),
        localeDe(view.clientIdioma),
      ),
      hora: formatTime(view.start, unit.timezone),
      unidade: unit.name,
      endereco: [unit.addressLine, unit.district].filter(Boolean).join(' — '),
    },
    view.clientIdioma,
  )

  return { link: whatsappLink(view.clientPhone, mensagem), mensagem }
}
