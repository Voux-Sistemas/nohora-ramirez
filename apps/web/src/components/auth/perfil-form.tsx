'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { atualizarPerfil, type PerfilState } from '@/app/conta/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import type { Dicionario } from '@/i18n'
import { formatPhone } from '@/lib/format'

/**
 * A cliente a arrumar a própria ficha.
 *
 * Dois campos, e um deles não se escreve. O telefone aparece porque ela precisa
 * de o reconhecer — é o que ela escreve para entrar — mas é texto, não caixa:
 * trocá-lo é trocar de identidade no sistema, e isso é conversa com a receção,
 * não um campo num formulário.
 *
 * As palavras entram por propriedade: isto é ecrã da cliente, e a cliente pode
 * estar a ler em inglês ou em espanhol.
 */
export function PerfilForm({
  nome,
  telefone,
  email,
  textos,
}: {
  nome: string
  telefone: string
  email: string | null
  textos: Dicionario['conta']['perfil']
}) {
  const [state, action] = useActionState<PerfilState, FormData>(atualizarPerfil, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="perfil-nome" className="mb-2 block text-sm font-medium">
          {textos.nome}
        </label>
        <input
          id="perfil-nome"
          name="nome"
          defaultValue={nome}
          required
          autoComplete="name"
          className="field"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">{textos.telefone}</span>
        <p className="tnum text-body text-[0.9375rem]">{formatPhone(telefone)}</p>
        <p className="text-muted mt-1.5 text-xs">{textos.telefoneAjuda}</p>
      </div>

      <div>
        <label htmlFor="perfil-email" className="mb-2 block text-sm font-medium">
          {textos.email}
        </label>
        <input
          id="perfil-email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
          defaultValue={email ?? ''}
          placeholder={textos.emailExemplo}
          aria-describedby="perfil-email-ajuda"
          className="field"
        />
        <p id="perfil-email-ajuda" className="text-muted mt-1.5 text-xs">
          {textos.emailAjuda}
        </p>
      </div>

      <Erro>{state.error}</Erro>
      {state.ok && !state.error ? (
        <p role="status" className="text-sm text-(--estado-bom)">
          {textos.guardado}
        </p>
      ) : null}

      <BotaoGuardar textos={textos} />
    </form>
  )
}

function BotaoGuardar({ textos }: { textos: Dicionario['conta']['perfil'] }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending} className="self-start">
      {pending ? textos.aGuardar : textos.guardar}
    </Button>
  )
}
