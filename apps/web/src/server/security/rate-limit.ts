import 'server-only'

/**
 * Freio de volume nas portas públicas.
 *
 * O que isto defende, em ordem de gravidade real:
 *
 * 1. **Adivinhação do código de instalação.** Acerta o código antes da dona e a
 *    conta de dona do salão é sua. Só existe janela até a primeira conta ser
 *    criada, mas dentro dela o estrago é total.
 * 2. **Força bruta na senha da equipe.** `verifyStaffLogin` respondia a quantas
 *    tentativas viessem. Sem freio, senha fraca cai em algumas horas de script
 *    — e quem entra vê a agenda inteira e o cadastro das clientes.
 * 3. **Enxurrada no agendamento público.** Qualquer pessoa com o link grava na
 *    agenda. Um script enche o dia de horário falso e o salão abre a porta com
 *    a agenda cheia de gente que não existe.
 * 4. **Pedido de código em série.** Cada um grava linha em `auth_otps`; quando
 *    o envio por WhatsApp existir, cada um também vira mensagem.
 *
 * A contagem vive na memória do processo, de propósito. O alvo é o script que
 * dispara centenas de vezes por minuto, e para esse alvo a janela em memória é
 * exata. Reinício de deploy zera os contadores — irrelevante, porque quem ataca
 * não escolhe a hora do nosso deploy. Se um dia houver mais de uma réplica,
 * cada uma terá seu contador e o teto efetivo multiplica; é aí que isto vira
 * Redis, não antes.
 *
 * O freio que protege a agenda de verdade não é este — é `booking-guard.ts`,
 * que conta no banco e por isso sobrevive a reinício, réplica e troca de IP.
 */

import { createRateLimiter, type Rule } from '@studio/core'

const freio = createRateLimiter()

/** Regras nomeadas, num lugar só, para dar para auditar de relance. */
export const RULES = {
  /* Uma pessoa erra a senha três, quatro vezes. Trinta é script. */
  loginEquipe: { limit: 8, windowSec: 300 },
  /* Marcar dois, três horários seguidos acontece; doze em cinco minutos, não. */
  agendamento: { limit: 6, windowSec: 300 },
  /* O cooldown de 60s por telefone já existe; este cobre a troca de telefone. */
  codigoOtp: { limit: 5, windowSec: 600 },
  /* Instalar acontece uma vez na vida do salão. Cinco é folga para quem digitou
     o código errado; qualquer número acima disso é alguém tentando adivinhar. */
  instalacao: { limit: 5, windowSec: 600 },
} as const satisfies Record<string, Rule>

export function hit(key: string, rule: Rule) {
  return freio.hit(key, rule)
}

export function forgive(key: string): void {
  freio.forgive(key)
}
