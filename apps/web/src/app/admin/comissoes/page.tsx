import { AdminShell, Section } from '@/components/admin/shell'
import { ConfirmarPagamento } from '@/components/admin/confirmar-pagamento'
import { Button } from '@/components/ui/button'
import { formatMoney, formatMoneyShort } from '@/lib/format'
import { listServicesAdmin } from '@/server/admin/services'
import { listStaffAdmin } from '@/server/admin/staff'
import { requireRede } from '@/server/auth/permissoes'
import { commissionSummaryByStaff, listCommissionRules } from '@/server/finance/commissions'
import { excluirRegra, pagarComissoes, salvarRegra } from './actions'

/* Da regra mais específica à mais geral — é a ordem em que o sistema decide
   qual vale quando duas se aplicam ao mesmo lançamento. */
const PRECEDENCIA = ['Profissional + serviço', 'Profissional', 'Serviço', 'Padrão da rede']

/**
 * Comissões: o dinheiro primeiro, a régua depois.
 *
 * A tela abria pelas regras — que a dona mexe uma vez por ano — e só depois
 * mostrava quem tem a receber, que é a razão de ela entrar aqui. Em ecrã largo
 * as duas cabem lado a lado, com o que se paga a ocupar a coluna maior.
 */
export default async function ComissoesPage() {
  /* Quanto cada profissional ganha é combinado da dona com ela. Um gerente
     lendo a régua de comissão da rede saberia o salário dos colegas. */
  const acesso = await requireRede()
  const [rules, summary, staff, services] = await Promise.all([
    listCommissionRules(),
    commissionSummaryByStaff(),
    listStaffAdmin(),
    listServicesAdmin(),
  ])

  const pendenteTotal = summary.reduce((soma, row) => soma + row.pendingAmount, 0)
  const aReceber = summary.filter((row) => row.pendingAmount > 0).length

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/comissoes"
      title="Comissões"
      meta={
        pendenteTotal > 0
          ? `${formatMoneyShort(pendenteTotal)} por pagar · ${aReceber} ${aReceber === 1 ? 'pessoa' : 'pessoas'}`
          : undefined
      }
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
        <Section title="A pagar" className="mb-0">
          {summary.length === 0 ? (
            <p className="text-muted plate p-10 text-center text-sm">
              Nenhuma comissão lançada ainda.
            </p>
          ) : (
            <div className="plate overflow-x-auto">
              <table className="w-full min-w-lg text-[0.9375rem]">
                <thead className="text-muted border-b border-(--border-subtle) text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Profissional</th>
                    <th className="px-5 py-3 text-right font-medium">Pendente</th>
                    <th className="px-5 py-3 text-right font-medium">Já pago</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr
                      key={row.staffId}
                      className="border-b border-(--border-subtle) transition-colors last:border-0 hover:bg-(--surface-sunken)"
                    >
                      <td className="px-5 py-3.5 font-medium">{row.staffName}</td>
                      <td className="tnum px-5 py-3.5 text-right font-medium whitespace-nowrap">
                        {row.pendingAmount > 0 ? (
                          formatMoney(row.pendingAmount)
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-muted tnum px-5 py-3.5 text-right whitespace-nowrap">
                        {formatMoney(row.paidAmount)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {row.pendingAmount > 0 ? (
                          <form action={pagarComissoes}>
                            <input type="hidden" name="staffId" value={row.staffId} />
                            <ConfirmarPagamento
                              nome={row.staffName}
                              valor={formatMoney(row.pendingAmount)}
                            />
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {pendenteTotal > 0 ? (
                  <tfoot>
                    <tr className="border-t border-(--border-strong)">
                      <td className="label-caps text-muted px-5 py-3">Total</td>
                      <td className="tnum px-5 py-3 text-right font-medium whitespace-nowrap">
                        {formatMoney(pendenteTotal)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Regras"
          hint="A primeira que casar decide — da mais específica à mais geral."
          className="mb-0"
        >
          <ol className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
            {PRECEDENCIA.map((passo, i) => (
              <li key={passo} className="flex items-center gap-2">
                <span className="border-(--border-subtle) text-muted tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs">
                  {i + 1}
                </span>
                <span>{passo}</span>
                {i < PRECEDENCIA.length - 1 ? (
                  <span className="text-muted" aria-hidden>
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          {rules.length === 0 ? (
            <p className="text-muted mb-4 text-sm">
              Nenhuma regra própria: tudo segue o padrão da rede.
            </p>
          ) : (
            <ul className="mb-5 flex flex-col">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="group flex items-baseline gap-3 border-b border-(--border-subtle) py-2.5 text-sm"
                >
                  <span className="tnum w-16 shrink-0 font-medium">
                    {(r.percentBps / 100).toFixed(2)}%
                  </span>
                  <span className="min-w-0 flex-1">
                    {r.staffName ?? <span className="text-muted">todos</span>}
                    <span className="text-muted"> · </span>
                    {r.serviceName ?? <span className="text-muted">todos</span>}
                  </span>
                  <form action={excluirRegra} className="shrink-0">
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-muted text-xs opacity-0 transition-opacity group-hover:opacity-100 hover:text-(--estado-mau) hover:underline focus-visible:opacity-100">
                      excluir
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <form action={salvarRegra} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-muted flex flex-col gap-1 text-sm">
                Profissional
                <select className="field" name="staffId" defaultValue="">
                  <option value="">todos</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-muted flex flex-col gap-1 text-sm">
                Serviço
                <select className="field" name="serviceId" defaultValue="">
                  <option value="">todos</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-end gap-3">
              <label className="text-muted flex flex-col gap-1 text-sm">
                Percentual (%)
                <input
                  className="field w-28"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="percent"
                  required
                />
              </label>
              <Button type="submit" variant="outline">
                Guardar regra
              </Button>
            </div>
          </form>
        </Section>
      </div>
    </AdminShell>
  )
}
