'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  cancelarMinhaMarcacao,
  type EstadoCancelamento,
} from '@/app/(site)/minha-conta/actions'
import { cn } from '@/lib/utils'

/**
 * Cancelar, com a confirmação na própria tela.
 *
 * Antes era um `confirm()` do navegador. Duas razões para sair: no telemóvel a
 * caixa do sistema aparece descolada da linha que se estava a ler — a pessoa
 * já não vê qual das marcações vai perder — e a frase dela não é nossa, é do
 * navegador, em inglês em metade dos telemóveis.
 *
 * Aqui a confirmação acontece onde o dedo já está, e a pergunta desfaz-se ao
 * fim de um clique fora. Cancelar é raro; desfazer o engano tem de ser trivial.
 */
export function BotaoCancelar({ id }: { id: string }) {
  const [estado, accao] = useActionState<EstadoCancelamento, FormData>(cancelarMinhaMarcacao, {})
  const [aConfirmar, setAConfirmar] = useState(false)

  if (!aConfirmar) {
    return (
      <div className="flex flex-col items-end gap-1">
        {estado.erro ? (
          <p role="alert" className="text-[0.75rem] text-(--color-signal-bad)">
            {estado.erro}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setAConfirmar(true)}
          className="rounded-plate text-muted min-h-9 px-1 text-[0.8125rem] underline-offset-4 transition-colors hover:text-(--color-signal-bad) hover:underline"
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <form action={accao} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-[0.8125rem] text-(--text-body)">Cancelar mesmo?</span>
      <button
        type="button"
        onClick={() => setAConfirmar(false)}
        className="rounded-plate text-muted min-h-9 px-1 text-[0.8125rem] hover:text-(--text-strong)"
      >
        Não
      </button>
      <Sim />
    </form>
  )
}

function Sim() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        'rounded-plate min-h-9 border border-(--color-signal-bad)/40 px-3 text-[0.8125rem] font-medium text-(--color-signal-bad) transition-colors',
        'hover:border-(--color-signal-bad) hover:bg-(--color-signal-bad)/8 disabled:opacity-50',
      )}
    >
      {pending ? 'A cancelar…' : 'Sim, cancelar'}
    </button>
  )
}
