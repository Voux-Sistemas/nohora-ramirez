import { isoDateInZone, zonedDateTime } from '@studio/core'
import { appointments, units } from '@studio/db'
import { and, asc, eq, gte, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { AdminShell, Section } from '@/components/admin/shell'
import { db } from '@/lib/db'
import { formatMoney } from '@/lib/format'
import { href } from '@/lib/utils'
import { listUnitsAdmin } from '@/server/admin/units'
import { listStaffAdmin } from '@/server/admin/staff'
import { listServicesAdmin } from '@/server/admin/services'
import { podeRede, requireGestao, unidadesVisiveis, type Acesso } from '@/server/auth/permissoes'
import { commissionSummaryByStaff } from '@/server/finance/commissions'

export const dynamic = 'force-dynamic'

interface UnitMonth {
  id: string
  name: string
  slug: string
  faturamento: number
  concluidos: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

async function loadMonthly(acesso: Acesso): Promise<UnitMonth[]> {
  const todas = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  const rows = unidadesVisiveis(acesso, todas)

  const result: UnitMonth[] = []
  for (const unit of rows) {
    const hoje = isoDateInZone(new Date(), unit.timezone)
    const [year, month] = hoje.split('-').map(Number) as [number, number]
    const monthStartIso = `${year}-${pad2(month)}-01`
    const [nextYear, nextMonth] = month === 12 ? [year + 1, 1] : [year, month + 1]
    const nextMonthStartIso = `${nextYear}-${pad2(nextMonth)}-01`

    const monthStart = zonedDateTime(monthStartIso, '00:00', unit.timezone)
    const monthEnd = zonedDateTime(nextMonthStartIso, '00:00', unit.timezone)

    const [stats] = await db
      .select({
        concluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
        faturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed'), 0)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.unitId, unit.id),
          gte(appointments.startsAt, monthStart),
          lt(appointments.startsAt, monthEnd),
        ),
      )

    result.push({
      id: unit.id,
      name: unit.name,
      slug: unit.slug,
      faturamento: stats?.faturamento ?? 0,
      concluidos: stats?.concluidos ?? 0,
    })
  }

  return result
}

/**
 * O painel da dona.
 *
 * "Hoje" (`/`) é a pauta do dia — uma linha por unidade, para abrir a loja de
 * manhã. Este é o mês: faixa de métrica, por unidade, comissão pendente. É a
 * pergunta que se faz sentada, não de pé no balcão, então tem mais ar e números
 * maiores. O gerente vê a mesma forma, recortada para as lojas dele e sem o que
 * é dinheiro de outra pessoa — regra de comissão continua sendo assunto só da
 * dona com cada profissional.
 */
export default async function AdminPainelPage() {
  const acesso = await requireGestao()
  const rede = podeRede(acesso)

  const [monthly, staff] = await Promise.all([loadMonthly(acesso), listStaffAdmin(acesso.unidadeIds)])

  const [unitsAll, services, commissions] = rede
    ? await Promise.all([listUnitsAdmin(), listServicesAdmin(), commissionSummaryByStaff()])
    : [null, null, null]

  const faturamentoTotal = monthly.reduce((acc, u) => acc + u.faturamento, 0)
  const equipeAtiva = staff.filter((s) => s.active).length
  const comissoesPendentes = (commissions ?? []).reduce((acc, c) => acc + c.pendingAmount, 0)
  const unidadesAtivas = (unitsAll ?? []).filter((u) => u.active).length
  const servicosAtivos = (services ?? []).filter((s) => s.active).length

  const pendentes = (commissions ?? [])
    .filter((c) => c.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 6)

  return (
    <AdminShell
      acesso={acesso}
      active="/painel/gestao"
      wide
      title="Painel"
      subtitle={rede ? 'O mês da rede, num relance.' : 'O mês das suas unidades, num relance.'}
    >
      <dl className="surface rounded-card mb-8 flex flex-wrap divide-x divide-(--border-subtle) overflow-hidden">
        <Metric label="Faturamento do mês" value={formatMoney(faturamentoTotal)} />
        {rede ? <Metric label="Comissões pendentes" value={formatMoney(comissoesPendentes)} /> : null}
        {rede ? (
          <Metric label="Unidades ativas" value={`${unidadesAtivas} / ${(unitsAll ?? []).length}`} />
        ) : null}
        <Metric
          label={rede ? 'Equipe ativa' : 'Equipe ativa na sua loja'}
          value={`${equipeAtiva} / ${staff.length}`}
        />
        {rede ? (
          <Metric label="Serviços ativos" value={`${servicosAtivos} / ${(services ?? []).length}`} />
        ) : null}
      </dl>

      {rede ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FaturamentoPorUnidade monthly={monthly} papel={acesso.papel} />
          <ComissoesPendentes pendentes={pendentes} />
        </div>
      ) : (
        <FaturamentoPorUnidade monthly={monthly} papel={acesso.papel} />
      )}
    </AdminShell>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-40 flex-1 px-6 py-5">
      <dt className="text-muted text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="tnum text-(--text-strong) mt-1.5 text-3xl leading-none font-medium">{value}</dd>
    </div>
  )
}

function FaturamentoPorUnidade({ monthly, papel }: { monthly: UnitMonth[]; papel: Acesso['papel'] }) {
  return (
    <Section title="Faturamento por unidade" hint="Mês corrente, atendimentos concluídos.">
      <div className="surface rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-[0.9375rem]">
          <thead className="text-muted border-b border-(--border-subtle) text-left">
            <tr>
              <th className="p-3.5 font-medium">Unidade</th>
              <th className="p-3.5 text-right font-medium">Atendimentos</th>
              <th className="p-3.5 text-right font-medium">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((unit) => (
              <tr
                key={unit.id}
                className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
              >
                <td className="p-3.5">
                  <Link href={href(`/painel`)} className="font-medium hover:underline">
                    {unit.name}
                  </Link>
                </td>
                <td className="tnum text-muted p-3.5 text-right">{unit.concluidos}</td>
                <td className="tnum p-3.5 text-right font-medium">{formatMoney(unit.faturamento)}</td>
              </tr>
            ))}
            {monthly.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-muted p-6 text-center">
                  {papel === 'dona'
                    ? 'Nenhuma unidade ativa ainda.'
                    : 'Nenhuma loja atribuída a você ainda. Fale com a administração.'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function ComissoesPendentes({
  pendentes,
}: {
  pendentes: { staffId: string; staffName: string; pendingAmount: number }[]
}) {
  return (
    <Section title="Comissões pendentes" hint="Maiores valores a pagar. Lista completa em Comissões.">
      <div className="surface rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-[0.9375rem]">
          <thead className="text-muted border-b border-(--border-subtle) text-left">
            <tr>
              <th className="p-3.5 font-medium">Profissional</th>
              <th className="p-3.5 text-right font-medium">Pendente</th>
            </tr>
          </thead>
          <tbody>
            {pendentes.map((row) => (
              <tr key={row.staffId} className="border-b border-(--border-subtle) last:border-0">
                <td className="p-3.5">{row.staffName}</td>
                <td className="tnum p-3.5 text-right font-medium">{formatMoney(row.pendingAmount)}</td>
              </tr>
            ))}
            {pendentes.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-muted p-6 text-center">
                  Nenhuma comissão pendente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-right text-sm">
        <Link href="/painel/gestao/comissoes" className="text-(--text-strong) underline underline-offset-4">
          ver todas as comissões →
        </Link>
      </p>
    </Section>
  )
}
