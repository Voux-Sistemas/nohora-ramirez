'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { PhoneInput } from '@/components/ui/phone-input'
import { pedirCodigo, type PhoneState } from '@/app/conta/entrar/actions'

export function PhoneForm() {
  const [state, action] = useActionState<PhoneState, FormData>(pedirCodigo, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Telefone
        <PhoneInput className="field" name="telefone" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Palavra-passe (só para login de teste)
        <input className="field" name="senha" type="password" autoComplete="off" />
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
      {pending ? 'A enviar…' : 'Receber código'}
    </Button>
  )
}
