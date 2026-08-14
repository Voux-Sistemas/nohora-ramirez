'use server'

import { revalidatePath } from 'next/cache'
import { paraCentimos } from '@/lib/format'
import { assertUnidade } from '@/server/auth/permissoes'
import { addMovement, closeSession, openSession, unitOfSession } from '@/server/finance/caixa'

/**
 * Abrir, fechar e sangrar o caixa.
 *
 * Nenhuma das três conferia nada: com o id de uma sessão, sem sessão de login,
 * dava para lançar uma retirada na gaveta de qualquer loja. A permissão é
 * sempre sobre a unidade lida do banco — `unitId` e `sessionId` chegam pelo
 * formulário e não valem como prova de nada.
 *
 * As três recusas que `server/finance/caixa.ts` escreve — já há caixa aberto,
 * o valor não é positivo, o caixa já está fechado — são coisas que quem está ao
 * balcão resolve de imediato, e portanto voltam como texto dentro do
 * formulário. Antes subiam como exceção até ao ecrã genérico de erro, que diz
 * que alguma coisa falhou e leva consigo o que já estava escrito.
 *
 * Permissão é a exceção que fica exceção: não é engano de quem preenche.
 */

export interface CaixaState {
  error?: string
  /** Só o lançamento precisa disto: abrir e fechar fazem a tela trocar de
   *  ramo, e o formulário desaparece com a resposta. O de lançar movimento
   *  fica onde está, e sem uma marca de sucesso não saberia limpar os campos —
   *  a segunda sangria da tarde sairia com o valor da primeira ainda escrito. */
  ok?: true
}

export async function abrirCaixa(
  _state: CaixaState,
  formData: FormData,
): Promise<CaixaState> {
  const unitId = String(formData.get('unitId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const openingAmount = paraCentimos(String(formData.get('openingAmount') ?? ''))
  if (!unitId) return { error: 'Unidade inválida.' }
  if (openingAmount === null) return { error: 'O valor de abertura tem de ser um número.' }

  await assertUnidade(unitId)
  const erro = await tentar(() => openSession(unitId, openingAmount), 'abrir', unitId)
  if (erro) return erro

  revalidatePath(`/caixa/${unitSlug}`)
  return {}
}

export async function fecharCaixa(
  _state: CaixaState,
  formData: FormData,
): Promise<CaixaState> {
  const sessionId = String(formData.get('sessionId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const contado = paraCentimos(String(formData.get('closingCountedAmount') ?? ''))
  if (!sessionId) return { error: 'Caixa inválido.' }
  if (contado === null) return { error: 'O valor contado tem de ser um número.' }

  await autorizarSessao(sessionId)
  const erro = await tentar(() => closeSession(sessionId, contado), 'fechar', sessionId)
  if (erro) return erro

  revalidatePath(`/caixa/${unitSlug}`)
  return {}
}

export async function lancarMovimento(
  _state: CaixaState,
  formData: FormData,
): Promise<CaixaState> {
  const sessionId = String(formData.get('sessionId') ?? '')
  const unitSlug = String(formData.get('unitSlug') ?? '')
  const type = String(formData.get('type') ?? '')
  const amount = paraCentimos(String(formData.get('amount') ?? ''))
  const note = String(formData.get('note') ?? '').trim()
  if (!sessionId) return { error: 'Caixa inválido.' }
  if (type !== 'reinforcement' && type !== 'withdrawal') {
    return { error: 'Escolha entre sangria e reforço.' }
  }
  if (amount === null) return { error: 'O valor tem de ser um número.' }
  if (amount === 0) return { error: 'Indique o valor a lançar.' }

  await autorizarSessao(sessionId)
  const erro = await tentar(
    () => addMovement(sessionId, type, amount, note || undefined),
    'lançar',
    sessionId,
  )
  if (erro) return erro

  revalidatePath(`/caixa/${unitSlug}`)
  return { ok: true }
}

async function autorizarSessao(sessionId: string): Promise<void> {
  const unitId = await unitOfSession(sessionId)
  if (!unitId) throw new Error('caixa não encontrado')
  await assertUnidade(unitId)
}

/**
 * As recusas do caixa são frases escritas para serem lidas ao balcão e voltam
 * inteiras, só com a maiúscula e o ponto que uma frase leva. O que não for uma
 * delas fica no log com o rastro todo, e para o ecrã vai só o que é verdade:
 * não deu, e não foi por causa de quem preencheu.
 */
async function tentar(
  accao: () => Promise<unknown>,
  verbo: string,
  alvo: string,
): Promise<CaixaState | null> {
  try {
    await accao()
    return null
  } catch (erro) {
    if (erro instanceof Error && erro.message.length <= 120) {
      return { error: `${erro.message.charAt(0).toUpperCase()}${erro.message.slice(1)}.` }
    }
    console.error(`[caixa] falha ao ${verbo}`, alvo, erro)
    return { error: 'Não foi possível concluir agora. Tente de novo.' }
  }
}
