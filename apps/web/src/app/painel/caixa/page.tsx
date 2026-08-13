import { isoDateInZone } from '@studio/core'
import { PainelShell, Vazio } from '@/components/shell/painel-shell'
import { Button } from '@/components/ui/button'
import { formatDateLong, formatMoney, formatTime, simboloMoeda } from '@/lib/format'
import { cn } from '@/lib/utils'
import { contextoDoPainel } from '@/server/painel/contexto'
import { podeGerir } from '@/server/auth/permissoes'
import { redirect } from 'next/navigation'
import { getOpenSession, listMovements, listSessionsForUnit } from '@/server/finance/caixa'
import { abrirCaixa, fecharCaixa, lancarMovimento } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Caixa' }

const MOVIMENTO: Record<string, string> = {
  payment: 'Pagamento',
  reinforcement: 'Reforço',
  withdrawal: 'Sangria',
}

/**
 * A gaveta da casa.
 *
 * A casa vem da barra do painel, não do endereço: quem estava a ver a agenda do
 * Valongo e clica em "Caixa" continua no Valongo. Antes esta tela era
 * `/caixa/[unidade]` e havia um índice `/caixa` só para voltar a escolher a
 * loja — a terceira tela de escolha do mesmo turno.
 */
export default async function CaixaPage() {
  const { acesso, unidades, unidade } = await contextoDoPainel()
  if (!podeGerir(acesso)) redirect('/painel/agenda')

  if (!unidade) {
    return (
      <PainelShell
        acesso={acesso}
        unidades={unidades}
        unidade={null}
        activa="caixa"
        titulo="Caixa"
        semCasa
      >
        <Vazio titulo="Nenhuma casa atribuída">Fale com a administração.</Vazio>
      </PainelShell>
    )
  }

  const sessao = await getOpenSession(unidade.id)
  const [movimentos, historico] = await Promise.all([
    sessao ? listMovements(sessao.id) : Promise.resolve([]),
    listSessionsForUnit(unidade.id),
  ])

  /*
    Mesma soma de `closeSession`: abertura + pagamentos e reforços − sangrias.
    Fechar só confirma o que já está aqui — a recepção não devia precisar de
    esperar pelo fecho para saber quanto tem na gaveta.
  */
  const saldo = sessao
    ? sessao.openingAmount +
      movimentos.reduce((soma, m) => soma + (m.type === 'withdrawal' ? -m.amount : m.amount), 0)
    : 0

  const moeda = simboloMoeda()

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="caixa"
      titulo="Caixa"
      acao={<Estado aberto={Boolean(sessao)} />}
    >
      {sessao ? (
        <>
          {/* O saldo é o assunto: número grande, em Bodoni, e nada a competir. */}
          <section className="rounded-plate border border-(--border-subtle) bg-(--surface-raised) p-6 sm:p-7">
            <p className="label-caps text-muted">Saldo em caixa</p>
            <p className="display tnum mt-2 text-[2.5rem] leading-none sm:text-[3rem]">
              {formatMoney(saldo)}
            </p>
            <p className="text-muted tnum mt-3 text-sm">
              Abertura {formatMoney(sessao.openingAmount)} · desde{' '}
              {formatDateLong(isoDateInZone(sessao.openedAt, unidade.timezone))}{' '}
              {formatTime(sessao.openedAt, unidade.timezone)}
            </p>
          </section>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_20rem] lg:items-start">
            <section>
              <h2 className="mb-3 font-medium">Movimentações</h2>
              <ul className="divide-y divide-(--border-subtle) border-t border-(--border-strong) text-sm">
                {movimentos.length === 0 ? (
                  <li className="text-muted py-3">Nenhuma movimentação ainda.</li>
                ) : (
                  movimentos.map((m) => (
                    <li key={m.id} className="flex items-baseline justify-between gap-3 py-2.5">
                      <span>
                        {MOVIMENTO[m.type] ?? m.type}
                        {m.note ? <span className="text-muted"> · {m.note}</span> : null}
                        <span className="text-muted">
                          {' '}
                          · {formatTime(m.occurredAt, unidade.timezone)}
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
              <section className="rounded-plate border border-(--border-subtle) bg-(--surface-raised) p-5">
                <h2 className="mb-3 font-medium">Lançar movimento</h2>
                <form action={lancarMovimento} className="flex flex-col gap-3">
                  <input type="hidden" name="sessionId" value={sessao.id} />
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Tipo
                    <select className="field font-normal" name="type" defaultValue="withdrawal">
                      <option value="withdrawal">Sangria</option>
                      <option value="reinforcement">Reforço</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Valor ({moeda})
                    <input
                      className="field tnum"
                      type="number"
                      step="0.01"
                      min="0"
                      name="amount"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Observação
                    <input className="field font-normal" name="note" placeholder="opcional" />
                  </label>
                  <Button type="submit" variant="outline" className="mt-1">
                    Lançar
                  </Button>
                </form>
              </section>

              <section className="rounded-plate border border-(--border-subtle) bg-(--surface-raised) p-5">
                <h2 className="mb-3 font-medium">Fechar caixa</h2>
                <form action={fecharCaixa} className="flex flex-col gap-3">
                  <input type="hidden" name="sessionId" value={sessao.id} />
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Valor contado ({moeda})
                    <input
                      className="field tnum"
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
        <section className="rounded-plate mx-auto max-w-sm border border-(--border-subtle) bg-(--surface-raised) p-7 text-center">
          <p className="display text-[1.5rem] leading-tight">Caixa fechado</p>
          <p className="text-muted mt-2 text-sm">
            Abra o caixa para começar a registar pagamentos, reforços e sangrias do dia.
          </p>
          <form action={abrirCaixa} className="mt-6 flex flex-col gap-3 text-left">
            <input type="hidden" name="unitId" value={unidade.id} />
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Valor de abertura ({moeda})
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
            <Button type="submit" size="lg">
              Abrir caixa
            </Button>
          </form>
        </section>
      )}

      {historico.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-muted mb-3 text-sm font-medium">Histórico</h2>
          <ul className="divide-y divide-(--border-subtle) border-t border-(--border-subtle) text-sm">
            {historico.map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <span className="first-letter:uppercase">
                  {formatDateLong(isoDateInZone(h.openedAt, unidade.timezone))}
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
    </PainelShell>
  )
}

/** Estado da gaveta, em forma antes de número: quem olha de longe já sabe. */
function Estado({ aberto }: { aberto: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        aberto
          ? 'border-(--color-signal-good)/30 text-(--color-signal-good)'
          : 'border-(--border-subtle) text-(--text-muted)',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          aberto ? 'bg-(--color-signal-good)' : 'bg-(--text-muted)',
        )}
      />
      {aberto ? 'Caixa aberto' : 'Caixa fechado'}
    </span>
  )
}
