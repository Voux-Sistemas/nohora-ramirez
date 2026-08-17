'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { atualizarPerfil, type PerfilState } from '@/app/conta/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { formatPhone } from '@/lib/format'

/**
 * A cliente a arrumar a própria ficha.
 *
 * Dois campos, e um deles não se escreve. O telefone aparece porque ela precisa
 * de o reconhecer — é o que ela escreve para entrar — mas é texto, não caixa:
 * trocá-lo é trocar de identidade no sistema, e isso é conversa com a receção,
 * não um campo num formulário.
 */
export function PerfilForm({
  nome,
  telefone,
  email,
}: {
  nome: string
  telefone: string
  email: string | null
}) {
  const [state, action] = useActionState<PerfilState, FormData>(atualizarPerfil, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="perfil-nome" className="mb-2 block text-sm font-medium">
          Nome
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
        <span className="mb-2 block text-sm font-medium">Telefone</span>
        <p className="tnum text-body text-[0.9375rem]">{formatPhone(telefone)}</p>
        <p className="text-muted mt-1.5 text-xs">
          É por aqui que entra e que a reconhecemos. Para mudar, fale com o salão.
        </p>
      </div>

      <div>
        <label htmlFor="perfil-email" className="mb-2 block text-sm font-medium">
          E-mail
        </label>
        <input
          id="perfil-email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="off"
          spellCheck={false}
          defaultValue={email ?? ''}
          placeholder="nome@exemplo.com"
          aria-describedby="perfil-email-ajuda"
          className="field"
        />
        <p id="perfil-email-ajuda" className="text-muted mt-1.5 text-xs">
          É para aqui que vai o código quando entrar. Use um e-mail a que tenha acesso — se ficar
          sem, a receção volta a abrir-lhe a porta.
        </p>
      </div>

      <Erro>{state.error}</Erro>
      {state.ok && !state.error ? (
        <p role="status" className="text-sm text-(--estado-bom)">
          Guardado.
        </p>
      ) : null}

      <BotaoGuardar />
    </form>
  )
}

function BotaoGuardar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending} className="self-start">
      {pending ? 'A guardar…' : 'Guardar'}
    </Button>
  )
}
