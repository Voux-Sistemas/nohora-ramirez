'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { fecharCaixa, type CaixaState } from '@/app/caixa/[unidade]/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { formatMoney, paraCentimos, simboloMoeda } from '@/lib/format'

/**
 * Fechar o caixa: contar o que está na gaveta e gravar a diferença.
 *
 * Fechar não tem volta — grava `closed`, a diferença fica no histórico e a
 * sessão do dia acabou. Não pede confirmação porque a confirmação seria uma
 * caixa a repetir o número que a pessoa acabou de escrever; em vez disso a
 * diferença aparece **enquanto** se escreve, que é a mesma revisão feita mais
 * cedo e sem um clique extra.
 *
 * Diferença diferente de zero não trava nada: é precisamente o que fechar o
 * caixa serve para registar. O que o número faz é dar a hipótese de recontar
 * antes, em vez de descobrir a falta amanhã no histórico.
 */
export function FecharCaixaForm({
  sessionId,
  unitSlug,
  esperado,
}: {
  sessionId: string
  unitSlug: string
  /** Abertura + pagamentos e reforços − sangrias, em cêntimos: a mesma soma
   *  que `closeSession` refaz no servidor para gravar a diferença. */
  esperado: number
}) {
  const [state, action] = useActionState<CaixaState, FormData>(fecharCaixa, {})
  const [contado, setContado] = useState('')

  const centimos = paraCentimos(contado)
  const diferenca = centimos === null ? null : centimos - esperado

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="unitSlug" value={unitSlug} />
      <label className="flex flex-col gap-1 text-sm">
        Valor contado ({simboloMoeda()})
        <input
          className="field tnum"
          type="number"
          step="0.01"
          min="0"
          name="closingCountedAmount"
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          required
        />
      </label>

      <p
        aria-live="polite"
        className="tnum flex items-baseline justify-between gap-2 text-xs"
      >
        <span className="text-muted">Esperado {formatMoney(esperado)}</span>
        {contado.trim() === '' || diferenca === null ? null : diferenca === 0 ? (
          <span className="font-medium text-(--estado-bom)">certo</span>
        ) : diferenca > 0 ? (
          <span className="font-medium text-(--estado-aviso)">
            sobra {formatMoney(diferenca)}
          </span>
        ) : (
          <span className="font-medium text-(--estado-mau)">
            falta {formatMoney(-diferenca)}
          </span>
        )}
      </p>

      <Erro>{state.error}</Erro>
      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="danger" className="mt-1" disabled={pending}>
      {pending ? 'A fechar…' : 'Fechar caixa'}
    </Button>
  )
}
