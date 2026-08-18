import { isoDateInZone } from '@studio/core'
import { notFound } from 'next/navigation'
import { AbrirCaixaForm } from '@/components/caixa/abrir-form'
import { EstadoDoCaixa } from '@/components/caixa/estado'
import { FecharCaixaForm } from '@/components/caixa/fechar-form'
import { MovimentoForm } from '@/components/caixa/movimento-form'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { requireGestao, requireUnidade } from '@/server/auth/permissoes'
import { getOpenSession, listMovements, listSessionsForUnit } from '@/server/finance/caixa'
import { getUnitBySlug } from '@/server/scheduling/context'

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
      {/*
        Aqui esteve um "← unidades", e ele mentia — a mesma seta que já saiu da
        agenda pela mesma razão. Não havia ecrã de unidades: `/caixa` sozinho
        reencaminhava para a PRIMEIRA loja da pessoa, e quem estava na Maia a
        conferir a gaveta carregava em voltar e aterrava em Valongo. Hoje esse
        endereço é uma tela de verdade, com as duas gavetas — e chega-se lá pelo
        "Todas" do seletor da barra, que é onde se troca de loja em todo o
        sistema. Duas portas para o mesmo sítio ensinariam duas gramáticas.
      */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">
            Caixa
          </h1>
          <p className="text-muted mt-1 text-sm">{unit.name}</p>
        </div>
        <EstadoDoCaixa aberto={session !== null} />
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
              {formatDateLong(isoDateInZone(session.openedAt, unit.timezone))}{' '}
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
                <MovimentoForm sessionId={session.id} unitSlug={unit.slug} saldo={balance} />
              </section>

              <section className="surface rounded-card p-5">
                <h2 className="mb-3 font-medium">Fechar caixa</h2>
                <FecharCaixaForm
                  sessionId={session.id}
                  unitSlug={unit.slug}
                  esperado={balance}
                />
              </section>
            </aside>
          </div>
        </>
      ) : (
        <section className="surface rounded-card mx-auto max-w-sm p-7 text-center">
          <p className="display text-[1.5rem] leading-tight">Caixa fechado</p>
          <p className="text-muted mt-2 text-sm">
            Abra o caixa para começar a registar pagamentos, reforços e sangrias do dia.
          </p>
          <AbrirCaixaForm unitId={unit.id} unitSlug={unit.slug} />
        </section>
      )}

      {history.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-muted mb-3 text-sm font-medium">Histórico</h2>
          <ul className="divide-y divide-(--border-subtle) text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {formatDateLong(isoDateInZone(h.openedAt, unit.timezone))}
                  <span className="text-muted"> · {h.status === 'open' ? 'aberto' : 'fechado'}</span>
                </span>
                <span className="tnum">
                  {h.difference !== null ? (
                    <span
                      className={
                        h.difference === 0
                          ? 'text-muted'
                          : h.difference > 0
                            ? 'text-(--estado-bom)'
                            : 'text-(--estado-mau)'
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
