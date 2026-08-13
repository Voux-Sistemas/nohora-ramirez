'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { entrarComoEquipa, type EstadoLogin } from '@/app/entrar/actions'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/phone-input'
import { pais } from '@/lib/pais'

export function StaffLoginForm({ destino }: { destino: string }) {
  const [estado, accao] = useActionState<EstadoLogin, FormData>(entrarComoEquipa, {})
  const { rotulos } = pais()

  return (
    <form action={accao} className="flex flex-col gap-4">
      <input type="hidden" name="destino" value={destino} />

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {rotulos.telemovel}
        <PhoneInput className="field font-normal" name="telefone" required autoFocus />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Senha
        <input
          className="field"
          name="senha"
          type="password"
          autoComplete="current-password"
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
      {pending ? 'A entrar…' : 'Entrar'}
    </Button>
  )
}
