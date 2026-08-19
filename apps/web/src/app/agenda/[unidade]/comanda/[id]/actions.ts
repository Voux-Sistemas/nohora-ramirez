'use server'

import { revalidatePath } from 'next/cache'
import { paraCentimos } from '@/lib/format'
import { assertUnidade } from '@/server/auth/permissoes'
import { ehFalhaTecnica } from '@/server/erros'
import {
  closeComanda,
  getComanda,
  metodosDoPais,
  type ClosePaymentInput,
  type PaymentMethod,
} from '@/server/finance/comanda'

export interface ComandaState {
  error?: string
}

/**
 * Fechar comanda grava pagamento, desconto e comissão. Não tinha porteiro
 * nenhum: com o id do atendimento na mão, sem sessão, dava para lançar um
 * "pago em dinheiro" no caixa da loja. A unidade que manda é a do atendimento,
 * lida do banco — `unitSlug` no formulário serve só para revalidar a tela.
 *
 * O que `closeComanda` recusa, recusa por motivos que quem está ao balcão
 * consegue resolver em dez segundos: a soma não bate, não há caixa aberto, a
 * comanda já foi fechada. Antes daqui todos eles subiam como exceção e caíam
 * na tela genérica de erro — a recepção via "alguma coisa falhou aqui", com o
 * motivo escrito só no log do Railway. Agora a mensagem volta para dentro do
 * formulário, ao lado dos campos que a resolvem.
 */
export async function fecharComanda(
  _state: ComandaState,
  formData: FormData,
): Promise<ComandaState> {
  const appointmentId = String(formData.get('appointmentId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  if (!appointmentId) return { error: 'Comanda inválida.' }

  const comanda = await getComanda(appointmentId)
  if (!comanda) return { error: 'Atendimento não encontrado.' }
  /* Permissão continua a ser exceção, e não mensagem no formulário: não é
     engano de quem preenche, é porta errada. */
  await assertUnidade(comanda.unitId)

  const discountAmount = paraCentimos(String(formData.get('discountAmount') ?? ''))
  if (discountAmount === null) return { error: 'O desconto tem de ser um valor em euros.' }

  const permitidos = new Set<PaymentMethod>(metodosDoPais())
  const paymentsInput: ClosePaymentInput[] = []
  for (let i = 1; i <= 3; i++) {
    const method = String(formData.get(`p${i}_method`) ?? '')
    const amount = paraCentimos(String(formData.get(`p${i}_amount`) ?? ''))
    if (amount === null) return { error: 'Cada valor recebido tem de ser um número.' }
    if (amount === 0) continue
    if (!permitidos.has(method as PaymentMethod)) {
      return { error: 'Escolha a forma de pagamento de cada valor lançado.' }
    }
    paymentsInput.push({ method: method as PaymentMethod, amount })
  }
  if (paymentsInput.length === 0) return { error: 'Lance pelo menos um pagamento.' }

  const discountReason = String(formData.get('discountReason') ?? '').trim()

  try {
    await closeComanda(appointmentId, {
      discountAmount,
      ...(discountReason ? { discountReason } : {}),
      payments: paymentsInput,
    })
  } catch (erro) {
    /* As recusas de `closeComanda` são escritas para serem lidas ao balcão e
       voltam inteiras. O que não for uma delas fica no log com o rastro todo, e
       para o ecrã vai só o que é verdade: não deu, e não foi por causa dela.
       O comprimento sozinho não chega para separar as duas: há erro de Postgres
       que cabe em 120 caracteres — ver `ehFalhaTecnica`. */
    if (!ehFalhaTecnica(erro) && erro instanceof Error && erro.message.length <= 120) {
      return { error: `${erro.message.charAt(0).toUpperCase()}${erro.message.slice(1)}.` }
    }
    console.error('[comanda] falha ao fechar', appointmentId, erro)
    return { error: 'Não foi possível fechar a comanda agora. Tente de novo.' }
  }

  revalidatePath(`/agenda/${unitSlug}/comanda/${appointmentId}`)
  revalidatePath('/agenda/[unidade]', 'page')
  return {}
}
