import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { href } from '@/lib/utils'
import { requireGestao, requireUnidade } from '@/server/auth/permissoes'
import { PAYMENT_METHOD_LABEL, getComanda } from '@/server/finance/comanda'
import { getUnitBySlug } from '@/server/scheduling/context'
import { fecharComanda } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Comanda é caixa: recebe dinheiro, dá desconto e credita comissão. Tela de
 * gestão, e presa à unidade do atendimento — o slug do endereço é só o caminho
 * de volta para a agenda, não a fonte da permissão.
 */
export default async function ComandaPage({
  params,
}: {
  params: Promise<{ unidade: string; id: string }>
}) {
  const { unidade, id } = await params
  const acesso = await requireGestao()
  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()

  const comanda = await getComanda(id)
  if (!comanda || comanda.unitId !== unit.id) notFound()
  requireUnidade(acesso, comanda.unitId)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href={href(`/agenda/${unit.slug}`)} className="text-muted text-sm hover:underline">
        ← agenda
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">Comanda</h1>
        <p className="text-muted mt-1 text-sm">{comanda.clientName}</p>
      </header>

      <section className="surface rounded-card mb-6 p-5">
        <h2 className="mb-3 font-medium">Itens</h2>
        <ul className="divide-y divide-(--border-subtle) text-sm">
          {comanda.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
              <span>
                {item.serviceName}
                <span className="text-muted"> · {item.staffName}</span>
              </span>
              <span className="tnum">{formatMoney(item.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-baseline justify-between border-t border-(--border-subtle) pt-3 text-sm">
          <span>Subtotal</span>
          <span className="tnum">{formatMoney(comanda.subtotal)}</span>
        </p>
        {comanda.discount > 0 ? (
          <p className="text-muted flex items-baseline justify-between text-sm">
            <span>Desconto{comanda.discountReason ? ` (${comanda.discountReason})` : ''}</span>
            <span className="tnum">− {formatMoney(comanda.discount)}</span>
          </p>
        ) : null}
        <p className="mt-1 flex items-baseline justify-between font-medium">
          <span>Total</span>
          <span className="tnum">{formatMoney(comanda.total)}</span>
        </p>
      </section>

      {comanda.closed ? (
        <section className="surface rounded-card p-5">
          <h2 className="mb-3 font-medium">Pagamento</h2>
          <ul className="divide-y divide-(--border-subtle) text-sm">
            {comanda.payments.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {PAYMENT_METHOD_LABEL[p.method]}
                  <span className="text-muted"> · {formatDateLong(p.paidAt.toISOString().slice(0, 10))} {formatTime(p.paidAt, unit.timezone)}</span>
                </span>
                <span className="tnum">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-3 text-sm">Comanda fechada — comissão gerada por item.</p>
        </section>
      ) : comanda.status !== 'completed' ? (
        <p className="surface rounded-card text-muted p-5 text-sm">
          Só é possível fechar a comanda depois que o atendimento estiver concluído.
        </p>
      ) : (
        <section className="surface rounded-card p-5">
          <h2 className="mb-3 font-medium">Fechar comanda</h2>
          <form action={fecharComanda} className="flex flex-col gap-4">
            <input type="hidden" name="appointmentId" value={comanda.appointmentId} />
            <input type="hidden" name="unitSlug" value={unit.slug} />

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Desconto (R$)
                <input className="field" type="number" step="0.01" min="0" name="discountAmount" defaultValue="0" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Motivo do desconto
                <input className="field" name="discountReason" placeholder="opcional" />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Pagamento (pode dividir em até 3 formas)</p>
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <select className="field" name={`p${i}_method`} defaultValue={i === 1 ? 'pix' : ''}>
                      <option value="">—</option>
                      <option value="cash">Dinheiro</option>
                      <option value="debit_card">Débito</option>
                      <option value="credit_card">Crédito</option>
                      <option value="pix">Pix</option>
                      <option value="other">Outro</option>
                    </select>
                    <input
                      className="field"
                      type="number"
                      step="0.01"
                      min="0"
                      name={`p${i}_amount`}
                      placeholder="R$ 0,00"
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted mt-2 text-xs">
                A soma dos pagamentos precisa bater exatamente com o total menos o desconto. Pagamento em
                dinheiro exige caixa aberto na unidade.
              </p>
            </div>

            <div>
              <Button type="submit">Fechar comanda</Button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
