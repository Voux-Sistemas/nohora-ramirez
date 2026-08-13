'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { confirmarCodigo, type EstadoCodigo } from '@/app/entrar/codigo/actions'
import { Button } from '@/components/ui/button'

export function CodeForm({ telefone }: { telefone: string }) {
  const [estado, accao] = useActionState<EstadoCodigo, FormData>(confirmarCodigo, {})

  return (
    <form action={accao} className="flex flex-col gap-4">
      <input type="hidden" name="telefone" value={telefone} />
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Código de seis dígitos
        <input
          className="field tnum text-center text-lg tracking-[0.3em]"
          name="codigo"
          inputMode="numeric"
          maxLength={6}
          autoComplete="one-time-code"
          autoFocus
          required
        />
      </label>

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 px-4 py-3 text-sm text-(--color-signal-bad)"
        >
          {estado.erro}
        </p>
      ) : null}

      <Enviar />
    </form>
  )
}

function Enviar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'A verificar…' : 'Entrar'}
    </Button>
  )
}
