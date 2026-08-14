'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
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

      <Erro>{state.error}</Erro>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'A verificar…' : 'Entrar'}
    </Button>
  )
}
