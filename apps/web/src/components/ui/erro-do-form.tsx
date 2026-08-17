'use client'

import { createContext, useContext } from 'react'

/**
 * O erro de um `useActionState` entregue ao formulário sem atravessar a
 * fronteira servidor→cliente com uma função.
 *
 * ── O que rebentou ────────────────────────────────────────────────────────
 * A ficha de profissional e a de cliente recebiam os campos como *função*:
 * `<StaffForm>{(state) => <>…</>}</StaffForm>`. O corpo do formulário é
 * desenhado no servidor e o `<StaffForm>` é `'use client'` — e uma função não
 * cabe no que o servidor consegue serializar para o cliente. O React recusava
 * o pedido inteiro antes de desenhar linha nenhuma:
 *
 *     Functions cannot be passed directly to Client Components
 *     {id: "novo", children: function children}
 *
 * Resultado: "Alguma coisa falhou aqui" ao abrir `/admin/equipe/novo` — e a
 * mesma tela em qualquer ficha de cliente. Não era o "novo": era toda a ficha.
 *
 * ── Por que contexto e não uma prop ───────────────────────────────────────
 * O erro nasce onde o formulário vive (no cliente, depois do envio) e é
 * mostrado no meio de um corpo desenhado no servidor. Prop não atravessa esse
 * caminho — só o contexto. Os filhos passam a ser JSX comum, que serializa, e
 * quem quer o erro pousa um `<ErroDoForm />` no sítio exato onde ele deve
 * aparecer.
 */

interface EstadoDeFormulario {
  error?: string
}

const Contexto = createContext<EstadoDeFormulario>({})

export function FornecerEstadoDoForm({
  estado,
  children,
}: {
  estado: EstadoDeFormulario
  children: React.ReactNode
}) {
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>
}

/** A recusa da última tentativa de gravar, ou nada. */
export function ErroDoForm({ className }: { className?: string }) {
  const { error } = useContext(Contexto)
  if (!error) return null
  return (
    <p className={className ?? 'mb-4 text-sm text-(--estado-mau)'} role="alert">
      {error}
    </p>
  )
}
