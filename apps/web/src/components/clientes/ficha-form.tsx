'use client'

import { useActionState } from 'react'
import { atualizarCliente, type ClienteState } from '@/app/clientes/[id]/actions'
import { FornecerEstadoDoForm } from '@/components/ui/erro-do-form'

/**
 * A ficha da cliente, do lado do cliente, só para ter onde pousar o erro —
 * mesma razão e mesma forma do `StaffForm`.
 *
 * Aqui a recusa mais provável é o telefone: a coluna por onde a cliente faz
 * login e por onde o sistema a reencontra na marcação seguinte. Recusar em voz
 * alta, ao lado do botão, com o resto do formulário intacto, é o mínimo — a
 * alternativa era gravar em silêncio um número que só parte semanas depois.
 */
export function FichaForm({
  clientId,
  children,
}: {
  clientId: string
  children: React.ReactNode
}) {
  const [state, action] = useActionState<ClienteState, FormData>(atualizarCliente, {})

  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="clientId" value={clientId} />
      <FornecerEstadoDoForm estado={state}>{children}</FornecerEstadoDoForm>
    </form>
  )
}
