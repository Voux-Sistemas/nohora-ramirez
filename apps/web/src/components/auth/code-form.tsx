'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { confirmarCodigo, type CodeState } from '@/app/conta/verificar/actions'

export function CodeForm({ telefone }: { telefone: string }) {
  const [state, action] = useActionState<CodeState, FormData>(confirmarCodigo, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="telefone" value={telefone} />
      <label className="flex flex-col gap-1 text-sm">
        Código de 6 dígitos
        <input
          className="field text-center text-lg tracking-[0.3em]"
          name="codigo"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          required
        />
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
      {pending ? 'Verificando…' : 'Entrar'}
    </Button>
  )
}
