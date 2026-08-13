import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { href } from '@/lib/utils'
import { requireGestao, requireUnidade } from '@/server/auth/permissoes'
import { getOpenSession, listMovements, listSessionsForUnit } from '@/server/finance/caixa'
import { getUnitBySlug } from '@/server/scheduling/context'
import { abrirCaixa, fecharCaixa, lancarMovimento } from './actions'

export const dynamic = 'force-dynamic'

const MOVEMENT_LABEL: Record<string, string> = {
  payment: 'Pagamento',
  reinforcement: 'Reforço',
  withdrawal: 'Sangria',
}

export default async function CaixaUnidadePage({
  params,
}: {
  params: Promise<{ unidade: string }>
}) {
  const { unidade } = await params
  const acesso = await requireGestao()
  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()
  requireUnidade(acesso, unit.id)

  const session = await getOpenSession(unit.id)
  const [movements, history] = await Promise.all([
    session ? listMovements(session.id) : Promise.resolve([]),
    listSessionsForUnit(unit.id),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href={href('/caixa')} className="text-muted text-sm hover:underline">
        ← unidades
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">Caixa</h1>
        <p className="text-muted mt-1 text-sm">{unit.name}</p>
      </header>

      {session ? (
        <>
          <section className="surface rounded-card mb-6 p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-medium">Caixa aberto</h2>
              <span className="text-muted text-sm">
                desde {formatDateLong(session.openedAt.toISOString().slice(0, 10))}{' '}
                {formatTime(session.openedAt, unit.timezone)}
              </span>
            </div>
            <p className="mt-2 flex items-baseline justify-between text-sm">
              <span>Valor de abertura</span>
              <span className="tnum">{formatMoney(session.openingAmount)}</span>
            </p>

            <ul className="mt-4 divide-y divide-(--border-subtle) text-sm">
              {movements.length === 0 ? (
                <li className="text-muted py-2">Nenhuma movimentação ainda.</li>
              ) : (
                movements.map((m) => (
                  <li key={m.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span>
                      {MOVEMENT_LABEL[m.type] ?? m.type}
                      {m.note ? <span className="text-muted"> · {m.note}</span> : null}
                      <span className="text-muted"> · {formatTime(m.occurredAt, unit.timezone)}</span>
                    </span>
                    <span className="tnum">
                      {m.type === 'withdrawal' ? '− ' : ''}
                      {formatMoney(m.amount)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="surface rounded-card mb-6 p-5">
            <h2 className="mb-3 font-medium">Lançar movimento</h2>
            <form action={lancarMovimento} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="unitSlug" value={unit.slug} />
              <label className="flex flex-col gap-1 text-sm">
                Tipo
                <select className="field" name="type" defaultValue="withdrawal">
                  <option value="withdrawal">Sangria</option>
                  <option value="reinforcement">Reforço</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Valor (R$)
                <input className="field" type="number" step="0.01" min="0" name="amount" required />
              </label>
              <label className="flex flex-1 min-w-40 flex-col gap-1 text-sm">
                Observação
                <input className="field" name="note" placeholder="opcional" />
              </label>
              <Button type="submit" variant="outline">
                Lançar
              </Button>
            </form>
          </section>

          <section className="surface rounded-card p-5">
            <h2 className="mb-3 font-medium">Fechar caixa</h2>
            <form action={fecharCaixa} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="sessionId" value={session.id} />
              <input type="hidden" name="unitSlug" value={unit.slug} />
              <label className="flex flex-col gap-1 text-sm">
                Valor contado (R$)
                <input
                  className="field"
                  type="number"
                  step="0.01"
                  min="0"
                  name="closingCountedAmount"
                  required
                />
              </label>
              <Button type="submit" variant="danger">
                Fechar caixa
              </Button>
            </form>
          </section>
        </>
      ) : (
        <section className="surface rounded-card mb-6 p-5">
          <h2 className="mb-3 font-medium">Abrir caixa</h2>
          <form action={abrirCaixa} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="unitSlug" value={unit.slug} />
            <label className="flex flex-col gap-1 text-sm">
              Valor de abertura (R$)
              <input className="field" type="number" step="0.01" min="0" name="openingAmount" defaultValue="0" required />
            </label>
            <Button type="submit">Abrir caixa</Button>
          </form>
        </section>
      )}

      {history.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-muted mb-3 text-sm font-medium">Histórico</h2>
          <ul className="divide-y divide-(--border-subtle) text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {formatDateLong(h.openedAt.toISOString().slice(0, 10))}
                  <span className="text-muted">
                    {' '}
                    · {h.status === 'open' ? 'aberto' : 'fechado'}
                  </span>
                </span>
                <span className="tnum">
                  {h.difference !== null ? (
                    <span className={h.difference === 0 ? 'text-muted' : h.difference > 0 ? 'text-green-600' : 'text-red-600'}>
                      {h.difference > 0 ? '+' : ''}
                      {formatMoney(h.difference)}
                    </span>
                  ) : (
                    formatMoney(h.openingAmount)
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
