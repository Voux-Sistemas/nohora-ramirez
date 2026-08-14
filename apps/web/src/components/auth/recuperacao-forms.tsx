'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { definirNovaSenha, pedirCodigoDeSenha, type EsqueciState } from '@/app/entrar/esqueci/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { PhoneInput } from '@/components/ui/phone-input'

function Enviar({ ocioso, ocupado }: { ocioso: string; ocupado: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? ocupado : ocioso}
    </Button>
  )
}

export function PedirCodigoForm() {
  const [state, action] = useActionState<EsqueciState, FormData>(pedirCodigoDeSenha, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Telefone
        <PhoneInput className="field" name="telefone" required />
      </label>
      <Erro>{state.error}</Erro>
      <Enviar ocioso="Receber código" ocupado="A enviar…" />
    </form>
  )
}

export function NovaSenhaForm({ telefone }: { telefone: string }) {
  const [state, action] = useActionState<EsqueciState, FormData>(definirNovaSenha, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="telefone" value={telefone} />
      <label className="flex flex-col gap-1 text-sm">
        Código do e-mail
        <input
          className="field tnum"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Nova palavra-passe
        <input
          className="field"
          name="senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="text-muted text-xs">Pelo menos 8 caracteres.</span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Repita a nova palavra-passe
        <input
          className="field"
          name="confirmar"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <Erro>{state.error}</Erro>
      <Enviar ocioso="Trocar a palavra-passe e entrar" ocupado="A trocar…" />
    </form>
  )
}
