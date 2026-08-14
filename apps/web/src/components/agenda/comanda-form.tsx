'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { fecharComanda, type ComandaState } from '@/app/agenda/[unidade]/comanda/[id]/actions'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { formatMoney, paraCentimos, simboloMoeda } from '@/lib/format'

const LINHAS = [1, 2, 3] as const

/**
 * O fecho da comanda.
 *
 * Vive do lado do cliente por duas razões, e as duas são da recepção. A
 * primeira é a mensagem de recusa: `closeComanda` recusa por coisas que se
 * resolvem ali — a soma não bate, não há caixa aberto — e essas frases têm de
 * aparecer ao lado dos campos, não numa tela de erro que perde o que já estava
 * escrito.
 *
 * A segunda é o **que falta**. O motivo de longe mais comum da recusa é a soma
 * dos pagamentos não fechar com o total, e é uma conta de cabeça feita com o
 * cliente à espera e o salão a falar à volta. Aqui a conta é contínua: a cada
 * tecla a linha diz quanto falta receber, quanto passou, ou que está certo — e
 * o botão só acende quando fecha. A recusa deixa de ser uma coisa que acontece
 * depois de carregar.
 */
export function ComandaForm({
  appointmentId,
  unitSlug,
  total,
  metodos,
}: {
  appointmentId: string
  unitSlug: string
  /** `appointments.total_price` — o mesmo número contra o qual o servidor
   *  confere a soma, para a conta desta tela não poder discordar da dele. */
  total: number
  metodos: readonly { valor: string; rotulo: string }[]
}) {
  const [state, action] = useActionState<ComandaState, FormData>(fecharComanda, {})
  const [desconto, setDesconto] = useState('')
  const [valores, setValores] = useState<Record<number, string>>({})

  const aReceber = total - centimos(desconto)
  const lancado = LINHAS.reduce((soma, i) => soma + centimos(valores[i] ?? ''), 0)
  const diferenca = aReceber - lancado
  const fecha = diferenca === 0 && lancado > 0

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="unitSlug" value={unitSlug} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Desconto ({simboloMoeda()})
          <input
            className="field tnum"
            type="number"
            step="0.01"
            min="0"
            name="discountAmount"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            placeholder="0,00"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Motivo do desconto
          <input className="field" name="discountReason" placeholder="opcional" />
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Pagamento (pode dividir em até 3 formas)</p>
        <div className="flex flex-col gap-2">
          {LINHAS.map((i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              {/* Nada pré-selecionado: a forma de pagamento é a única coisa
                  desta tela que o sistema não consegue adivinhar, e um valor
                  por omissão aqui é uma resposta dada em nome de quem está ao
                  balcão. */}
              <select className="field" name={`p${i}_method`} defaultValue="">
                <option value="">—</option>
                {metodos.map((metodo) => (
                  <option key={metodo.valor} value={metodo.valor}>
                    {metodo.rotulo}
                  </option>
                ))}
              </select>
              <input
                className="field tnum"
                type="number"
                step="0.01"
                min="0"
                name={`p${i}_amount`}
                value={valores[i] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [i]: e.target.value }))}
                placeholder={i === 1 ? formatMoney(aReceber) : ''}
              />
            </div>
          ))}
        </div>
      </div>

      <p
        aria-live="polite"
        className="tnum flex items-baseline justify-between border-t border-(--border-subtle) pt-3 text-sm"
      >
        <span className="text-muted">A receber {formatMoney(aReceber)}</span>
        {lancado === 0 ? null : fecha ? (
          <span className="font-medium text-(--estado-bom)">certo</span>
        ) : diferenca > 0 ? (
          <span className="font-medium">faltam {formatMoney(diferenca)}</span>
        ) : (
          <span className="font-medium text-(--estado-mau)">
            passou {formatMoney(-diferenca)}
          </span>
        )}
      </p>

      <Erro>{state.error}</Erro>

      <p className="text-muted text-xs">
        Pagamento em dinheiro exige caixa aberto na unidade.
      </p>

      <div>
        <Submit pronto={fecha} />
      </div>
    </form>
  )
}

function Submit({ pronto }: { pronto: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || !pronto}>
      {pending ? 'A fechar…' : 'Fechar comanda'}
    </Button>
  )
}

/** Enquanto se escreve, o que ainda não é número vale zero: a linha do resto
 *  continua a somar em vez de piscar um erro a meio de uma tecla. A recusa de
 *  verdade é do servidor, e essa vem por inteiro. */
function centimos(texto: string): number {
  return paraCentimos(texto) ?? 0
}
