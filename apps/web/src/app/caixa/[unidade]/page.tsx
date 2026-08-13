import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
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

  /*
    Mesma soma de `closeSession`: abertura + pagamentos e reforços − sangrias.
    Fechar só confirma o que já está aqui — a recepção não deveria precisar
    esperar o fechamento para saber quanto tem na gaveta.
  */
  const balance = session
    ? session.openingAmount +
      movements.reduce((sum, m) => sum + (m.type === 'withdrawal' ? -m.amount : m.amount), 0)
    : 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link href={href('/caixa')} className="text-muted text-sm hover:underline">
        ← unidades
      </Link>

      <header className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">
            Caixa
          </h1>
          <p className="text-muted mt-1 text-sm">{unit.name}</p>
        </div>
        <StatusPill open={Boolean(session)} />
      </header>

      {session ? (
        <>
          <section className="surface rounded-card p-6 sm:p-7">
            <p className="label-caps text-muted">Saldo em caixa</p>
            <p className="display tnum mt-2 text-[2.5rem] leading-none sm:text-[3rem]">
              {formatMoney(balance)}
            </p>
            <p className="text-muted tnum mt-3 text-sm">
              Abertura {formatMoney(session.openingAmount)} · desde{' '}
              {formatDateLong(session.openedAt.toISOString().slice(0, 10))}{' '}
              {formatTime(session.openedAt, unit.timezone)}
            </p>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
            <section className="surface rounded-card p-5">
              <h2 className="mb-3 font-medium">Movimentações</h2>
              <ul className="divide-y divide-(--border-subtle) text-sm">
                {movements.length === 0 ? (
                  <li className="text-muted py-2">Nenhuma movimentação ainda.</li>
                ) : (
                  movements.map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span>
                        {MOVEMENT_LABEL[m.type] ?? m.type}
                        {m.note ? <span className="text-muted"> · {m.note}</span> : null}
                        <span className="text-muted">
                          {' '}
                          · {formatTime(m.occurredAt, unit.timezone)}
                        </span>
                      </span>
                      <span className="tnum shrink-0">
                        {m.type === 'withdrawal' ? '− ' : ''}
                        {formatMoney(m.amount)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <aside className="flex flex-col gap-6">
              <section className="surface rounded-card p-5">
                <h2 className="mb-3 font-medium">Lançar movimento</h2>
                <form action={lancarMovimento} className="flex flex-col gap-3">
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
                    <input
                      className="field"
                      type="number"
                      step="0.01"
                      min="0"
                      name="amount"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Observação
                    <input className="field" name="note" placeholder="opcional" />
                  </label>
                  <Button type="submit" variant="outline" className="mt-1">
                    Lançar
                  </Button>
                </form>
              </section>

              <section className="surface rounded-card p-5">
                <h2 className="mb-3 font-medium">Fechar caixa</h2>
                <form action={fecharCaixa} className="flex flex-col gap-3">
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
                  <Button type="submit" variant="danger" className="mt-1">
                    Fechar caixa
                  </Button>
                </form>
              </section>
            </aside>
          </div>
        </>
      ) : (
        <section className="surface rounded-card mx-auto max-w-sm p-7 text-center">
          <p className="display text-[1.5rem] leading-tight">Caixa fechado</p>
          <p className="text-muted mt-2 text-sm">
            Abra o caixa para começar a registrar pagamentos, reforços e sangrias do dia.
          </p>
          <form action={abrirCaixa} className="mt-6 flex flex-col gap-3 text-left">
            <input type="hidden" name="unitId" value={unit.id} />
            <input type="hidden" name="unitSlug" value={unit.slug} />
            <label className="flex flex-col gap-1 text-sm">
              Valor de abertura (R$)
              <input
                className="field"
                type="number"
                step="0.01"
                min="0"
                name="openingAmount"
                defaultValue="0"
                required
              />
            </label>
            <Button type="submit" size="lg">
              Abrir caixa
            </Button>
          </form>
        </section>
      )}

      {history.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-muted mb-3 text-sm font-medium">Histórico</h2>
          <ul className="divide-y divide-(--border-subtle) text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {formatDateLong(h.openedAt.toISOString().slice(0, 10))}
                  <span className="text-muted"> · {h.status === 'open' ? 'aberto' : 'fechado'}</span>
                </span>
                <span className="tnum">
                  {h.difference !== null ? (
                    <span
                      className={
                        h.difference === 0
                          ? 'text-muted'
                          : h.difference > 0
                            ? 'text-(--color-signal-good)'
                            : 'text-(--color-signal-bad)'
                      }
                    >
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

/** Estado da gaveta, em forma antes de número: quem olha de longe já sabe. */
function StatusPill({ open }: { open: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        open
          ? 'border-(--color-signal-good)/30 text-(--color-signal-good)'
          : 'border-(--border-subtle) text-(--text-muted)',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          open ? 'bg-(--color-signal-good)' : 'bg-(--text-muted)',
        )}
      />
      {open ? 'Caixa aberto' : 'Caixa fechado'}
    </span>
  )
}
