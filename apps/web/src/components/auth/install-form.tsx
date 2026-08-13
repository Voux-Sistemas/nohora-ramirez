'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { instalar, type InstalarState } from '@/app/comecar/actions'

export function InstallForm() {
  const [state, action] = useActionState<InstalarState, FormData>(instalar, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Nome completo
        <input className="field" name="nome" autoComplete="name" required />
      </label>
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
      <label className="flex flex-col gap-1 text-sm">
        E-mail
        <input className="field" name="email" type="email" autoComplete="email" required />
        {/* Não é cadastro de contato: é a única saída se esta senha se perder.
            Esta conta não tem a quem recorrer — é ela que cria as outras. */}
        <span className="text-muted text-xs">
          Se você esquecer a senha, o código para trocá-la vai para cá.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Senha
        {/*
          `new-password` faz o gerenciador de senhas oferecer uma senha forte em
          vez de tentar preencher com a do login da equipe, que ainda não existe.
        */}
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
        Repita a senha
        <input
          className="field"
          name="confirmar"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Código de instalação
        <input
          className="field"
          name="codigo"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
        />
        <span className="text-muted text-xs">
          Está com quem instalou o sistema.
        </span>
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 p-3 text-sm text-(--color-signal-bad)"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Criando…' : 'Criar minha conta'}
    </Button>
  )
}
