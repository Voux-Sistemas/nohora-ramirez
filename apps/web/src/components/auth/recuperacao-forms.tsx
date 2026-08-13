'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { definirNovaSenha, pedirCodigoDeSenha, type EsqueciState } from '@/app/entrar/esqueci/actions'
import { Button } from '@/components/ui/button'

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return (
    <p
      role="alert"
      className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 p-3 text-sm text-(--color-signal-bad)"
    >
      {mensagem}
    </p>
  )
}

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
        <input
          className="field"
          name="telefone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-8888"
          required
        />
      </label>
      <Erro mensagem={state.error} />
      <Enviar ocioso="Receber código" ocupado="Enviando…" />
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
        Nova senha
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
        Repita a nova senha
        <input
          className="field"
          name="confirmar"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <Erro mensagem={state.error} />
      <Enviar ocioso="Trocar senha e entrar" ocupado="Trocando…" />
    </form>
  )
}
