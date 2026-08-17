'use server'

import { redirect } from 'next/navigation'
import { destroySession } from './session'

/**
 * Fecha a sessão e devolve a pessoa ao sítio certo, que não é o mesmo para as
 * duas metades da casa.
 *
 * Sem `para`, a raiz: a cliente que sai da conta dela cai na montra, que é onde
 * ela quer estar. A barra da equipa passa `/entrar`, porque quem clica em "sair"
 * de dentro da operação está quase sempre a trocar de pessoa — o balcão é
 * partilhado. Deixá-la na montra obrigava a escrever o endereço da porta à mão.
 *
 * `para` só pode ser caminho interno: um destino que venha do formulário é
 * entrada de fora, e redirecionar para fora depois de encerrar sessão é um
 * presente para quem quiser montar um sítio parecido com o nosso.
 */
export async function sair(formData?: FormData): Promise<void> {
  const pedido = String(formData?.get('para') ?? '')
  const destino = pedido.startsWith('/') && !pedido.startsWith('//') ? pedido : '/'
  await destroySession()
  redirect(destino as never)
}
