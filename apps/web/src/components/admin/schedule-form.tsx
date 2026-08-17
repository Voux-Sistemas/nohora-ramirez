'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { salvarEscala, type EscalaState } from '@/app/admin/equipe/[id]/actions'
import { Button } from '@/components/ui/button'

/**
 * A escala semanal, do lado do cliente, só para ter onde pousar a recusa.
 *
 * Antes era um `<form action={salvarEscala}>` cru sobre uma ação que devolvia
 * `void`: qualquer recusa saía como exceção e caía no ecrã de "alguma coisa
 * falhou aqui", levando as sete linhas preenchidas com ela. Guardar uma terça
 * que acaba antes de começar é engano de digitação normal, não avaria — tem de
 * voltar como uma frase ao lado do botão.
 *
 * As sete linhas continuam a ser desenhadas no servidor e entram aqui como JSX
 * comum — passá-las como função é o que já rebentou a ficha inteira uma vez
 * (ver `components/ui/erro-do-form.tsx`).
 */
export function ScheduleForm({ staffId, children }: { staffId: string; children: React.ReactNode }) {
  const [state, action] = useActionState<EscalaState, FormData>(salvarEscala, {})

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="staffId" value={staffId} />
      {children}
      {state.error ? (
        <p className="text-sm text-(--estado-mau)" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className="text-sm text-(--estado-bom)">Escala atualizada.</p> : null}
      <div>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? 'A guardar…' : 'Guardar escala'}
    </Button>
  )
}
