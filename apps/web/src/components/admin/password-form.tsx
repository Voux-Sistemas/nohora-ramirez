'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { salvarSenha, type PasswordState } from '@/app/admin/equipe/[id]/actions'

/* Só o `staffId` viaja: de qual conta é a senha é o servidor que decide, olhando
   o cadastro. Com o `userId` no formulário, trocar esse campo trocava a senha de
   qualquer pessoa — inclusive a da dona. */
export function PasswordForm({ staffId }: { staffId: string }) {
  const [state, action] = useActionState<PasswordState, FormData>(salvarSenha, {})

  return (
    <form action={action} className="flex flex-col gap-3">
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
      {state.error ? <p className="text-sm text-(--estado-mau)">{state.error}</p> : null}
      {state.success ? (
        <p className="text-sm text-(--estado-bom)">Senha atualizada.</p>
      ) : null}
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
