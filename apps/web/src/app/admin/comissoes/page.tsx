import { AdminShell, Section } from '@/components/admin/shell'
import { ConfirmarPagamento } from '@/components/admin/confirmar-pagamento'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { listServicesAdmin } from '@/server/admin/services'
import { listStaffAdmin } from '@/server/admin/staff'
import { requireRede } from '@/server/auth/permissoes'
import { commissionSummaryByStaff, listCommissionRules } from '@/server/finance/commissions'
import { excluirRegra, pagarComissoes, salvarRegra } from './actions'

/* Da regra mais específica à mais geral — é a ordem em que o sistema decide
   qual vale quando duas se aplicam ao mesmo lançamento. */
const PRECEDENCIA = ['Profissional + serviço', 'Profissional', 'Serviço', 'Padrão da rede']

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

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/comissoes"
      title="Comissões"
      subtitle="Regras por profissional e/ou serviço, e o que está pendente de pagamento."
    >
      <Section title="Regras" hint="A primeira regra que casar decide — da mais específica à mais geral.">
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
          <p className="text-muted mb-4 p-6 text-center text-sm">Nenhuma regra cadastrada ainda.</p>
        ) : (
          <div className="surface rounded-card mb-4 overflow-hidden">
            <table className="hidden w-full text-[0.9375rem] sm:table">
              <thead className="text-muted border-b border-(--border-subtle) text-left">
                <tr>
                  <th className="p-3.5 font-medium">Profissional</th>
                  <th className="p-3.5 font-medium">Serviço</th>
                  <th className="p-3.5 text-right font-medium">%</th>
                  <th className="p-3.5" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-(--border-subtle) last:border-0">
                    <td className="p-3.5">{r.staffName ?? <span className="text-muted">todos</span>}</td>
                    <td className="p-3.5">{r.serviceName ?? <span className="text-muted">todos</span>}</td>
                    <td className="p-3.5 text-right tnum">{(r.percentBps / 100).toFixed(2)}%</td>
                    <td className="p-3.5 text-right">
                      <form action={excluirRegra}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="text-muted text-xs hover:text-(--estado-mau) hover:underline">
                          excluir
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="sm:hidden">
              {rules.map((r) => (
                <li key={r.id} className="border-b border-(--border-subtle) p-3.5 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="tnum font-medium">{(r.percentBps / 100).toFixed(2)}%</span>
                    <form action={excluirRegra}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="text-muted text-xs hover:text-(--estado-mau) hover:underline">
                        excluir
                      </button>
                    </form>
                  </div>
                  <div className="text-muted mt-1 text-sm">
                    {r.staffName ?? 'todos'} · {r.serviceName ?? 'todos'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form action={salvarRegra} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
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
          <label className="flex flex-col gap-1 text-sm">
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
          <label className="flex flex-col gap-1 text-sm">
            Percentual (%)
            <input className="field w-28" type="number" step="0.01" min="0" max="100" name="percent" required />
          </label>
          <Button type="submit" variant="outline">
            Salvar regra
          </Button>
        </form>
      </Section>

      <Section title="A pagar" hint="Soma dos lançamentos gerados no fechamento de cada comanda.">
        {summary.length === 0 ? (
          <p className="text-muted p-6 text-center text-sm">Nenhuma comissão lançada ainda.</p>
        ) : (
          <div className="surface rounded-card overflow-hidden">
            <table className="hidden w-full text-[0.9375rem] sm:table">
              <thead className="text-muted border-b border-(--border-subtle) text-left">
                <tr>
                  <th className="p-3.5 font-medium">Profissional</th>
                  <th className="p-3.5 text-right font-medium">Pendente</th>
                  <th className="p-3.5 text-right font-medium">Pago</th>
                  <th className="p-3.5" />
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.staffId} className="border-b border-(--border-subtle) last:border-0">
                    <td className="p-3.5">{row.staffName}</td>
                    <td className="p-3.5 text-right tnum font-medium">{formatMoney(row.pendingAmount)}</td>
                    <td className="text-muted p-3.5 text-right tnum">{formatMoney(row.paidAmount)}</td>
                    <td className="p-3.5 text-right">
                      {row.pendingAmount > 0 ? (
                        <form action={pagarComissoes}>
                          <input type="hidden" name="staffId" value={row.staffId} />
                          <ConfirmarPagamento nome={row.staffName} valor={formatMoney(row.pendingAmount)} />
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="sm:hidden">
              {summary.map((row) => (
                <li key={row.staffId} className="border-b border-(--border-subtle) p-3.5 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{row.staffName}</span>
                    <span className="tnum font-medium">{formatMoney(row.pendingAmount)}</span>
                  </div>
                  <div className="text-muted mt-1 flex items-center justify-between gap-3 text-sm">
                    <span className="tnum">pago: {formatMoney(row.paidAmount)}</span>
                    {row.pendingAmount > 0 ? (
                      <form action={pagarComissoes}>
                        <input type="hidden" name="staffId" value={row.staffId} />
                        <ConfirmarPagamento nome={row.staffName} valor={formatMoney(row.pendingAmount)} />
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </AdminShell>
  )
}
