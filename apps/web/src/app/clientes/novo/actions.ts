'use server'

import { redirect } from 'next/navigation'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { assertGestao } from '@/server/auth/permissoes'
import { mensagemDoErro } from '@/server/erros'
import { findOrCreateClient } from '@/server/people/clients'

export interface NovaClienteState {
  error?: string
}

/**
 * Cadastrar uma cliente à mão — ao balcão, ou ao telefone.
 *
 * Reusa `findOrCreateClient`, o mesmo caminho da marcação online, de propósito.
 * É ele que sabe as três coisas que um `insert` escrito aqui não saberia: que a
 * chave é o telefone e não o nome, que uma pessoa pode já existir como
 * profissional e só lhe faltar o perfil de cliente, e que um e-mail novo nunca
 * apaga o que já estava gravado. Sem isso, a mesma cliente ganhava a segunda
 * ficha na primeira sexta-feira cheia — e o histórico dela ficava partido em
 * duas metades que ninguém volta a juntar.
 *
 * Por isso este ecrã não recusa quem já existe: leva à ficha que já há. O
 * `?ja=1` é o que faz a recepção perceber que chegou a uma ficha antiga em vez
 * de a uma nova — o nome que ela acabou de escrever não sobrepõe o que lá
 * estava, e um salto calado deixá-la-ia a olhar para outro nome.
 */
export async function criarCliente(
  _state: NovaClienteState,
  formData: FormData,
): Promise<NovaClienteState> {
  await assertGestao()

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'Preencha o nome.' }

  /* Normalizado ou nada. É a coluna por onde ela entra na conta e por onde a
     marcação seguinte a reencontra: gravar `934 730 344` onde o resto do
     sistema guarda `+351934730344` não dá erro nenhum hoje, só duplica a ficha
     dentro de duas semanas. */
  const phone = toE164(String(formData.get('phone') ?? ''))
  if (!phone) return { error: telefoneInvalidoErro() }

  let clientId: string
  let jaExistia: boolean
  try {
    const identidade = await findOrCreateClient({
      phone,
      name,
      email: String(formData.get('email') ?? '').trim() || undefined,
      preferredUnitId: String(formData.get('preferredUnitId') ?? '').trim() || undefined,
    })
    clientId = identidade.clientId
    jaExistia = identidade.returning
  } catch (erro) {
    return { error: mensagemDoErro(erro, 'não foi possível criar esta ficha') }
  }

  /* Fora do `try`: `redirect` trabalha a lançar, e apanhá-lo ali devolvia «não
     foi possível criar esta ficha» por cima de uma ficha que ficou criada. */
  redirect(`/clientes/${clientId}${jaExistia ? '?ja=1' : ''}` as never)
}
