import { AdminShell, Section } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { listServicesAdmin } from '@/server/admin/services'
import { listStaffAdmin } from '@/server/admin/staff'
import { requireRede } from '@/server/auth/permissoes'
import { commissionSummaryByStaff, listCommissionRules } from '@/server/finance/commissions'
import { excluirRegra, pagarComissoes, salvarRegra } from './actions'

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
      <Section
        title="Regras"
        hint="Precedência: profissional + serviço → profissional → serviço → padrão da rede (deixe ambos em branco)."
      >
        <div className="surface rounded-card mb-4 overflow-hidden overflow-x-auto">
          <table className="w-full text-[0.9375rem]">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="p-3.5 font-medium">Profissional</th>
                <th className="p-3.5 font-medium">Serviço</th>
                <th className="p-3.5 font-medium text-right">%</th>
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
                      <button className="text-muted text-xs hover:text-(--color-signal-bad) hover:underline">
                        excluir
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted p-6 text-center">
                    Nenhuma regra cadastrada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

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
        <div className="surface rounded-card overflow-hidden overflow-x-auto">
          <table className="w-full text-[0.9375rem]">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="p-3.5 font-medium">Profissional</th>
                <th className="p-3.5 font-medium text-right">Pendente</th>
                <th className="p-3.5 font-medium text-right">Pago</th>
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
                        <Button type="submit" size="sm" variant="outline">
                          Marcar pago
                        </Button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
              {summary.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted p-6 text-center">
                    Nenhuma comissão lançada ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>
    </AdminShell>
  )
}
