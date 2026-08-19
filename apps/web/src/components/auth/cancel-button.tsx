'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { cancelarMeuAgendamento, type CancelState } from '@/app/conta/actions'
import { buttonVariants } from '@/components/ui/button'
import type { Dicionario } from '@/i18n'
import { cn } from '@/lib/utils'

/** Só as três frases deste botão — a secção inteira da conta não lhe diz respeito. */
type Textos = Pick<Dicionario['conta'], 'cancelarPergunta' | 'aCancelar' | 'cancelar'>

export function CancelButton({ id, textos }: { id: string; textos: Textos }) {
  const [state, action] = useActionState<CancelState, FormData>(cancelarMeuAgendamento, {})

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(textos.cancelarPergunta)) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      {state.error ? <p className="text-xs text-(--estado-mau)">{state.error}</p> : null}
      <SubmitButton textos={textos} />
    </form>
  )
}

function SubmitButton({ textos }: { textos: Textos }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: 'danger', size: 'sm' }))}>
      {pending ? textos.aCancelar : textos.cancelar}
    </button>
  )
}
