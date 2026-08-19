import type { AppointmentView } from '@/server/scheduling/queries'

/**
 * Os estados em que a confirmação por WhatsApp ainda diz alguma coisa.
 *
 * De `checked_in` em diante a cliente já está na loja: escrever-lhe a perguntar
 * se vem é a mensagem que faz a casa parecer distraída, e desenhar a marca é
 * ruído numa grelha onde o que interessa passou a ser outra coisa. Antes disso,
 * é o trabalho da véspera — e é exactamente o que a dona quer ver de relance.
 *
 * A mesma lista serve o botão (`appointment-panel.tsx`) e a marca: se um dia
 * divergirem, há um estado em que a agenda mostra o sinal e não deixa tirá-lo.
 */
export const A_CONFIRMAR = new Set(['scheduled', 'confirmed'])

/**
 * O ponto que diz "esta já levou recado".
 *
 * Um ponto de 6px e não uma sexta cor de bloco: o estado do atendimento é peso
 * de tinta (DESIGN §8) e essa escala está cheia — meter aqui mais um tom era
 * pedir à dona que decorasse cinco superfícies em vez de quatro. Isto é outro
 * eixo de informação e por isso é outra forma: um sinal pequeno, ao lado, que
 * se conta de relance ("faltam três") sem disputar a leitura do estado.
 *
 * Verde de `--estado-bom` porque é o único papel semântico que já significa
 * "isto está tratado" em toda a casa.
 */
export function MarcaDeConfirmacao({ appointment }: { appointment: AppointmentView }) {
  if (appointment.confirmacaoEnviadaEm === null) return null
  if (!A_CONFIRMAR.has(appointment.status)) return null

  return (
    <>
      <span
        aria-hidden
        className="inline-block size-1.5 shrink-0 rounded-full bg-(--estado-bom) align-middle"
      />
      {/* Quem lê por leitor de ecrã não vê ponto nenhum: ouve a frase inteira. */}
      <span className="sr-only">confirmação enviada no WhatsApp · </span>
    </>
  )
}
