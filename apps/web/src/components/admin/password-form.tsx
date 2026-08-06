'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { salvarSenha, type PasswordState } from '@/app/admin/equipe/[id]/actions'

export function PasswordForm({ userId, staffId }: { userId: string; staffId: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(salvarSenha, {})

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="staffId" value={staffId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Nova senha
          <input className="field" type="password" name="senha" minLength={8} required />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Confirmar senha
          <input className="field" type="password" name="confirmar" minLength={8} required />
        </label>
      </div>
      {state.error ? <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700 dark:text-green-400">Senha atualizada.</p> : null}
      <div>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? 'Salvando…' : 'Definir senha'}
    </Button>
  )
}
