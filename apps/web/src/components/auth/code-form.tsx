'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { confirmarCodigo, type CodeState } from '@/app/conta/verificar/actions'
import type { Dicionario } from '@/i18n'

type Textos = Dicionario['conta']['verificar']

export function CodeForm({ telefone, textos }: { telefone: string; textos: Textos }) {
  const [state, action] = useActionState<CodeState, FormData>(confirmarCodigo, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="telefone" value={telefone} />
      <label className="flex flex-col gap-1 text-sm">
        {textos.codigo}
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

      <SubmitButton textos={textos} />
    </form>
  )
}

function SubmitButton({ textos }: { textos: Textos }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? textos.aVerificar : textos.entrar}
    </Button>
  )
}
