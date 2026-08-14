'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { lancarMovimento, type CaixaState } from '@/app/caixa/[unidade]/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { formatMoney, paraCentimos, simboloMoeda } from '@/lib/format'

/**
 * Sangria e reforço.
 *
 * É o único formulário desta tela que continua no ecrã depois de gravar, e daí
 * as duas coisas que ele faz e os outros não: limpa-se a si próprio quando o
 * lançamento passa (senão a segunda sangria da tarde sai com o valor da
 * primeira ainda escrito), e diz de antemão em quanto fica a gaveta. O saldo
 * depois é a conta que a recepção faz de cabeça a olhar para as notas; fazê-la
 * aqui custa uma linha e evita a sangria de 200 numa gaveta de 150.
 */
export function MovimentoForm({
  sessionId,
  unitSlug,
  saldo,
}: {
  sessionId: string
  unitSlug: string
  /** Saldo em gaveta antes deste lançamento, em cêntimos. */
  saldo: number
}) {
  const [state, action] = useActionState<CaixaState, FormData>(lancarMovimento, {})
  const [tipo, setTipo] = useState<'withdrawal' | 'reinforcement'>('withdrawal')
  const [valor, setValor] = useState('')

  useEffect(() => {
    if (state.ok) setValor('')
  }, [state])

  const centimos = paraCentimos(valor) ?? 0
  const depois = tipo === 'withdrawal' ? saldo - centimos : saldo + centimos

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="unitSlug" value={unitSlug} />
      <label className="flex flex-col gap-1 text-sm">
        Tipo
        <select
          className="field"
          name="type"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as 'withdrawal' | 'reinforcement')}
        >
          <option value="withdrawal">Sangria</option>
          <option value="reinforcement">Reforço</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Valor ({simboloMoeda()})
        <input
          className="field tnum"
          type="number"
          step="0.01"
          min="0"
          name="amount"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Observação
        <input className="field" name="note" placeholder="opcional" />
      </label>

      {centimos > 0 ? (
        <p aria-live="polite" className="tnum text-muted text-xs">
          Fica em{' '}
          <span className={depois < 0 ? 'font-medium text-(--estado-mau)' : 'font-medium'}>
            {formatMoney(depois)}
          </span>
          {depois < 0 ? ' — mais do que há na gaveta' : ''}
        </p>
      ) : null}

      <Erro>{state.error}</Erro>
      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" className="mt-1" disabled={pending}>
      {pending ? 'A lançar…' : 'Lançar'}
    </Button>
  )
}
