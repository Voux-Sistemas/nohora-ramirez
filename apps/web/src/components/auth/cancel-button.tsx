'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { cancelarMeuAgendamento, type CancelState } from '@/app/conta/actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function CancelButton({ id }: { id: string }) {
  const [state, action] = useActionState<CancelState, FormData>(cancelarMeuAgendamento, {})

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm('Cancelar esse agendamento?')) e.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={id} />
      {state.error ? <p className="text-xs text-(--estado-mau)">{state.error}</p> : null}
      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(buttonVariants({ variant: 'danger', size: 'sm' }))}>
      {pending ? 'Cancelando…' : 'Cancelar'}
    </button>
  )
}
