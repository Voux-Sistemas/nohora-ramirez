'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { pedirCodigo, type EstadoTelefone } from '@/app/entrar/actions'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/phone-input'
import { pais } from '@/lib/pais'

/**
 * `demo` vem do servidor e não de `ehTeste()` aqui dentro: `AMBIENTE` não é
 * exposta ao navegador (só `PAIS` é, ver `next.config.ts`), então a chamada
 * daria sempre "produção" e o campo da demonstração desapareceria justamente
 * no ambiente onde ele é a única forma de entrar.
 */
export function PhoneForm({ demo = false }: { demo?: boolean }) {
  const [estado, accao] = useActionState<EstadoTelefone, FormData>(pedirCodigo, {})
  const { rotulos } = pais()

  return (
    <form action={accao} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {rotulos.telemovel}
        <PhoneInput className="field font-normal" name="telefone" required autoFocus />
      </label>

      {/*
        O campo de senha só existe para o atalho da demonstração. Em produção
        ele seria um campo que não faz nada — e um campo que não faz nada num
        formulário de entrada é o que faz uma pessoa achar que se esqueceu de
        uma senha que nunca teve.
      */}
      {demo ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Senha
          <span className="text-muted -mt-1 text-[0.75rem] font-normal">
            só para as contas de demonstração
          </span>
          <input className="field" name="senha" type="password" autoComplete="off" />
        </label>
      ) : null}

      {estado.erro ? (
        <p
          role="alert"
          className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 px-4 py-3 text-sm text-(--color-signal-bad)"
        >
          {estado.erro}
        </p>
      ) : null}

      <Enviar rotulo="Receber código" aDecorrer="A enviar…" />
    </form>
  )
}

function Enviar({ rotulo, aDecorrer }: { rotulo: string; aDecorrer: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? aDecorrer : rotulo}
    </Button>
  )
}
