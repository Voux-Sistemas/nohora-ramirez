'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { pedirCodigo, type PhoneState } from '@/app/conta/entrar/actions'

export function PhoneForm() {
  const [state, action] = useActionState<PhoneState, FormData>(pedirCodigo, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Telefone
        <input
          className="field"
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-8888"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha (só para login de teste)
        <input className="field" name="senha" type="password" autoComplete="off" />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 p-3 text-sm text-(--color-signal-bad)"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Enviando…' : 'Receber código'}
    </Button>
  )
}
