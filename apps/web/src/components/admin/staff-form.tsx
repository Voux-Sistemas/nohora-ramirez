'use client'

import { useActionState } from 'react'
import { salvarProfissional, type ProfissionalState } from '@/app/admin/equipe/[id]/actions'

/**
 * A ficha de profissional, do lado do cliente, só para ter onde pousar o erro.
 *
 * Antes, uma recusa de validação — telefone fora do formato do país, nenhuma
 * unidade marcada — saía como exceção da server action e caía na tela de
 * "alguma coisa falhou aqui": a dona perdia a ficha inteira e não ficava a
 * saber qual campo estava errado. Com `useActionState` a mesma recusa volta
 * como texto ao lado do botão, e o que já foi preenchido continua no ecrã.
 */
export function StaffForm({
  id,
  children,
}: {
  id: string
  children: (state: ProfissionalState) => React.ReactNode
}) {
  const [state, action] = useActionState<ProfissionalState, FormData>(salvarProfissional, {})

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {children(state)}
    </form>
  )
}
