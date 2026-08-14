'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { abrirCaixa, type CaixaState } from '@/app/caixa/[unidade]/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { simboloMoeda } from '@/lib/format'

/**
 * Abrir a gaveta com o troco do dia.
 *
 * A única recusa possível é "já existe um caixa aberto nesta unidade" — o que
 * na prática significa que outra pessoa da loja abriu primeiro, noutro
 * separador. É uma frase que resolve o assunto sozinha, e por isso aparece
 * aqui em vez de atirar a recepção para o ecrã genérico de erro.
 */
export function AbrirCaixaForm({ unitId, unitSlug }: { unitId: string; unitSlug: string }) {
  const [state, action] = useActionState<CaixaState, FormData>(abrirCaixa, {})

  return (
    <form action={action} className="mt-6 flex flex-col gap-3 text-left">
      <input type="hidden" name="unitId" value={unitId} />
      <input type="hidden" name="unitSlug" value={unitSlug} />
      <label className="flex flex-col gap-1 text-sm">
        Valor de abertura ({simboloMoeda()})
        <input
          className="field tnum"
          type="number"
          step="0.01"
          min="0"
          name="openingAmount"
          defaultValue="0"
          required
        />
      </label>
      <Erro>{state.error}</Erro>
      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? 'A abrir…' : 'Abrir caixa'}
    </Button>
  )
}
