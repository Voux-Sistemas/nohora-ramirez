'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { PhoneInput } from '@/components/ui/phone-input'
import { pedirCodigo, type PhoneState } from '@/app/conta/entrar/actions'
import type { Dicionario } from '@/i18n'

type Textos = Dicionario['conta']['entrar']

export function PhoneForm({ textos }: { textos: Textos }) {
  const [state, action] = useActionState<PhoneState, FormData>(pedirCodigo, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        {textos.telefone}
        <PhoneInput className="field" name="telefone" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        {textos.palavraPasse}
        <input className="field" name="senha" type="password" autoComplete="off" />
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
      {pending ? textos.aEnviar : textos.receberCodigo}
    </Button>
  )
}
