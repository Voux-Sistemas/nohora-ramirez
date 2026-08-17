'use client'

import { useActionState } from 'react'
import { FornecerEstadoDoForm, type EstadoDeFormulario } from './erro-do-form'

/**
 * Um formulário do painel que sabe recusar.
 *
 * ── O que havia antes ─────────────────────────────────────────────────────
 * `<form action={salvarServico}>` sobre uma ação que devolve `void`. Duas
 * saídas, as duas más:
 *
 * - **validação** era `if (!input.name) return` — a ação não fazia nada e não
 *   dizia nada. A dona carregava em Guardar e o ecrã ficava exactamente igual.
 *   Ela carregava outra vez. Não há defeito mais difícil de reportar do que um
 *   botão que não responde.
 * - **recusa do banco** — o slug repetido, o horário que fecha antes de abrir —
 *   subia como exceção até ao ecrã genérico de erro e levava o formulário
 *   inteiro com ela, com tudo o que já estava escrito.
 *
 * ── Por que um invólucro e não seis ───────────────────────────────────────
 * Uma Server Action *é* serializável para o cliente — é isso que faz
 * `<form action={acaoDoServidor}>` funcionar. Portanto o invólucro pode receber
 * a ação como prop e servir a todos os formulários do painel, em vez de um
 * componente `'use client'` por ecrã. Os campos continuam a ser desenhados no
 * servidor e entram como JSX comum; o erro sai por contexto, num
 * `<ErroDoForm />` pousado onde ele deve aparecer. Passá-los como função é o
 * que já rebentou a ficha inteira uma vez — ver `erro-do-form.tsx`.
 */
export function FormComEstado({
  action,
  children,
  className,
}: {
  action: (estado: EstadoDeFormulario, formData: FormData) => Promise<EstadoDeFormulario>
  children: React.ReactNode
  className?: string
}) {
  const [estado, acao] = useActionState<EstadoDeFormulario, FormData>(action, {})

  return (
    <form action={acao} className={className}>
      <FornecerEstadoDoForm estado={estado}>{children}</FornecerEstadoDoForm>
    </form>
  )
}
