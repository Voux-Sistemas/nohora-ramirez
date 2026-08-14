'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { PhoneInput } from '@/components/ui/phone-input'
import { entrarComoEquipe, type LoginState } from '@/app/entrar/actions'

export function StaffLoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(entrarComoEquipe, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1 text-sm">
        Telefone
        <PhoneInput className="field" name="telefone" required />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Palavra-passe
        <input className="field" name="senha" type="password" autoComplete="current-password" required />
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
      {pending ? 'A entrar…' : 'Entrar'}
    </Button>
  )
}
