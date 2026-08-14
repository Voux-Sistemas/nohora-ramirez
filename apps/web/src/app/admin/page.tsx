import { addDaysInZone, isoDateInZone, zonedDateTime } from '@studio/core'
import { LIVE_APPOINTMENT_STATUSES, appointments, units } from '@studio/db'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { AdminShell, Section } from '@/components/admin/shell'
import { db } from '@/lib/db'
import { formatMoney, formatMoneyShort } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { podeRede, requireGestao, unidadesVisiveis, type Acesso } from '@/server/auth/permissoes'
import { commissionSummaryByStaff } from '@/server/finance/commissions'

export const dynamic = 'force-dynamic'

interface UnitStat {
  id: string
  name: string
  slug: string
  faturamento: number
  concluidos: number
  faturamentoAnterior: number
  concluidosAnterior: number
  marcadosCount: number
  marcadosFaturamento: number
}

interface Comparativo {
  atual: number
  anterior: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Enum já validado no schema — junta os valores num IN() literal em vez de
 *  parametrizar um array, que pediria `= any()` explícito no driver. */
const STATUSES_AINDA_VALEM = sql.raw(
  LIVE_APPOINTMENT_STATUSES.map((status) => `'${status}'`).join(', '),
)

/**
 * Uma consulta por fuso horário distinto — na prática uma só, porque as
 * unidades estão todas em Portugal. Cada consulta agrega, por unidade, três
 * janelas de uma vez (mês corrente, mesmo trecho do mês anterior, próximos 7
 * dias) em vez do laço antigo que abria uma consulta por unidade e ainda
 * recalculava os limites do mês a cada volta.
 */
async function loadDashboard(acesso: Acesso): Promise<UnitStat[]> {
  const todas = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  const rows = unidadesVisiveis(acesso, todas)
  if (rows.length === 0) return []

  const agora = new Date()
  const porFuso = new Map<string, typeof rows>()
  for (const unit of rows) {
    const grupo = porFuso.get(unit.timezone) ?? []
    grupo.push(unit)
    porFuso.set(unit.timezone, grupo)
  }

  const porUnidade = new Map<string, UnitStat>(
    rows.map((unit) => [
      unit.id,
      {
        id: unit.id,
        name: unit.name,
        slug: unit.slug,
        faturamento: 0,
        concluidos: 0,
        faturamentoAnterior: 0,
        concluidosAnterior: 0,
        marcadosCount: 0,
        marcadosFaturamento: 0,
      },
    ]),
  )

  for (const [timezone, unidadesDoFuso] of porFuso) {
    const hoje = isoDateInZone(agora, timezone)
    const [year, month, diaAtual] = hoje.split('-').map(Number) as [number, number, number]

    const monthStartIso = `${year}-${pad2(month)}-01`
    const [nextYear, nextMonth] = month === 12 ? [year + 1, 1] : [year, month + 1]
    const nextMonthStartIso = `${nextYear}-${pad2(nextMonth)}-01`
    const [prevYear, prevMonth] = month === 1 ? [year - 1, 12] : [year, month - 1]
    const prevMonthStartIso = `${prevYear}-${pad2(prevMonth)}-01`

    /*
      "Mesmo trecho do mês anterior", não o mês anterior inteiro: comparar o
      mês corrente pela metade com o mês passado completo faria o mês
      corrente parecer sempre murcho. O corte usa a mesma contagem de dias —
      dia 13 deste mês contra os primeiros 13 dias do mês passado — e se
      autolimita ao início do mês corrente quando o mês anterior é mais
      curto (dia 31 de janeiro contra um fevereiro de 28 dias).
    */
    const cutoffCandidate = addDaysInZone(prevMonthStartIso, diaAtual)
    const prevPeriodEndIso = cutoffCandidate < monthStartIso ? cutoffCandidate : monthStartIso
    const em7DiasIso = addDaysInZone(hoje, 7)

    const monthStart = zonedDateTime(monthStartIso, '00:00', timezone)
    const monthEnd = zonedDateTime(nextMonthStartIso, '00:00', timezone)
    const prevMonthStart = zonedDateTime(prevMonthStartIso, '00:00', timezone)
    const prevPeriodEnd = zonedDateTime(prevPeriodEndIso, '00:00', timezone)
    const em7Dias = zonedDateTime(em7DiasIso, '00:00', timezone)

    const ids = unidadesDoFuso.map((u) => u.id)

    const linhas = await db
      .select({
        unitId: appointments.unitId,
        concluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${monthStart} and ${appointments.startsAt} < ${monthEnd})::int`,
        faturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${monthStart} and ${appointments.startsAt} < ${monthEnd}), 0)::int`,
        concluidosAnterior: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${prevMonthStart} and ${appointments.startsAt} < ${prevPeriodEnd})::int`,
        faturamentoAnterior: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${prevMonthStart} and ${appointments.startsAt} < ${prevPeriodEnd}), 0)::int`,
        marcadosCount: sql<number>`count(*) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agora} and ${appointments.startsAt} < ${em7Dias})::int`,
        marcadosFaturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agora} and ${appointments.startsAt} < ${em7Dias}), 0)::int`,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.unitId, ids),
          gte(appointments.startsAt, prevMonthStart),
          lt(appointments.startsAt, em7Dias),
        ),
      )
      .groupBy(appointments.unitId)

    for (const linha of linhas) {
      const atual = porUnidade.get(linha.unitId)
      if (!atual) continue
      atual.concluidos = linha.concluidos
      atual.faturamento = linha.faturamento
      atual.concluidosAnterior = linha.concluidosAnterior
      atual.faturamentoAnterior = linha.faturamentoAnterior
      atual.marcadosCount = linha.marcadosCount
      atual.marcadosFaturamento = linha.marcadosFaturamento
    }
  }

  return rows.map((unit) => porUnidade.get(unit.id) as UnitStat)
}

function variacaoPct({ atual, anterior }: Comparativo): number | null {
  // Sem base de comparação — mês passado zerado não divide.
  if (anterior === 0) return null
  return ((atual - anterior) / anterior) * 100
}

/**
 * O painel da dona.
 *
 * "Hoje" (`/`) é a pauta do dia — uma linha por unidade, para abrir a loja de
 * manhã. Este é o mês: quanto entrou, quanto entra ainda esta semana, e onde.
 * Cada métrica de fluxo (faturamento, atendimentos, ticket médio) vem com a
 * variação contra o mesmo trecho do mês anterior — um número sozinho não
 * responde nada. O gerente vê a mesma forma, recortada para as lojas dele e
 * sem o que é dinheiro de outra pessoa: regra de comissão continua sendo
 * assunto só da dona com cada profissional.
 */
export default async function AdminPainelPage() {
  const acesso = await requireGestao()
  const rede = podeRede(acesso)

  const [monthly, commissions] = await Promise.all([
    loadDashboard(acesso),
    rede ? commissionSummaryByStaff() : Promise.resolve(null),
  ])

  const faturamentoTotal = monthly.reduce((acc, u) => acc + u.faturamento, 0)
  const faturamentoAnteriorTotal = monthly.reduce((acc, u) => acc + u.faturamentoAnterior, 0)
  const concluidosTotal = monthly.reduce((acc, u) => acc + u.concluidos, 0)
  const concluidosAnteriorTotal = monthly.reduce((acc, u) => acc + u.concluidosAnterior, 0)
  const ticketMedio = concluidosTotal > 0 ? Math.round(faturamentoTotal / concluidosTotal) : 0
  const ticketMedioAnterior =
    concluidosAnteriorTotal > 0 ? Math.round(faturamentoAnteriorTotal / concluidosAnteriorTotal) : 0
  const comissoesPendentes = (commissions ?? []).reduce((acc, c) => acc + c.pendingAmount, 0)

  const pendentes = (commissions ?? [])
    .filter((c) => c.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 6)

  return (
    <AdminShell
      acesso={acesso}
      active="/admin"
      title="Painel"
      subtitle={rede ? 'O mês da rede, num relance.' : 'O mês das suas unidades, num relance.'}
    >
      <div
        className={cn(
          'mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-(--border-subtle) bg-(--border-subtle)',
          rede ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
        )}
      >
        <Metric
          label="Faturamento do mês"
          value={formatMoneyShort(faturamentoTotal)}
          comparativo={{ atual: faturamentoTotal, anterior: faturamentoAnteriorTotal }}
        />
        <Metric
          label="Atendimentos"
          value={String(concluidosTotal)}
          comparativo={{ atual: concluidosTotal, anterior: concluidosAnteriorTotal }}
        />
        <Metric
          label="Ticket médio"
          value={formatMoney(ticketMedio)}
          comparativo={{ atual: ticketMedio, anterior: ticketMedioAnterior }}
        />
        {rede ? (
          <Metric
            label="Comissões pendentes"
            value={formatMoneyShort(comissoesPendentes)}
            // Saldo em aberto agora, não um fluxo do mês — comparar com "o
            // pendente no mesmo dia do mês passado" pediria reconstruir o
            // histórico de commissionEntries a partir de createdAt/paidAt,
            // que hoje a consulta não faz. Mostra o número tal como é.
            nota="saldo em aberto agora"
          />
        ) : null}
      </div>

      <JaMarcado unidades={monthly} />

      {rede ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <FaturamentoPorUnidade monthly={monthly} papel={acesso.papel} />
          <ComissoesPendentes pendentes={pendentes} />
        </div>
      ) : (
        <FaturamentoPorUnidade monthly={monthly} papel={acesso.papel} />
      )}
    </AdminShell>
  )
}

function Metric({
  label,
  value,
  comparativo,
  nota,
}: {
  label: string
  value: string
  comparativo?: Comparativo
  nota?: string
}) {
  const pct = comparativo ? variacaoPct(comparativo) : undefined

  return (
    <div className="bg-(--surface) p-5 sm:p-6">
      <dt className="text-muted text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="tnum text-(--text-strong) mt-1.5 text-[1.75rem] leading-none font-medium sm:text-3xl">
        {value}
      </dd>
      <p className="mt-2.5 text-xs">
        {comparativo ? (
          pct === null || pct === undefined ? (
            <span className="text-muted">sem comparação — mês passado zerado</span>
          ) : (
            <span
              className={cn('font-medium', pct >= 0 ? 'text-(--estado-bom)' : 'text-(--estado-mau)')}
            >
              {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%{' '}
              <span className="text-muted font-normal">vs. mês passado até hoje</span>
            </span>
          )
        ) : nota ? (
          <span className="text-muted">{nota}</span>
        ) : (
          ' '
        )}
      </p>
    </div>
  )
}

function JaMarcado({ unidades }: { unidades: UnitStat[] }) {
  if (unidades.length === 0) return null

  const count = unidades.reduce((acc, u) => acc + u.marcadosCount, 0)
  const faturamento = unidades.reduce((acc, u) => acc + u.marcadosFaturamento, 0)

  return (
    <Section
      title="Já marcado"
      hint="Marcações que ainda valem para os próximos 7 dias — o número que antecipa a semana."
    >
      <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
        <div>
          <p className="tnum text-(--text-strong) text-3xl leading-none font-medium">{count}</p>
          <p className="text-muted mt-1.5 text-xs font-medium tracking-wide uppercase">atendimentos</p>
        </div>
        <div>
          <p className="tnum text-(--text-strong) text-3xl leading-none font-medium">
            {formatMoneyShort(faturamento)}
          </p>
          <p className="text-muted mt-1.5 text-xs font-medium tracking-wide uppercase">receita prevista</p>
        </div>

        {unidades.length > 1 ? (
          <div className="flex flex-1 flex-wrap items-start gap-x-8 gap-y-3 border-l border-(--border-subtle) pl-8">
            {unidades.map((u) => (
              <div key={u.id} className="text-sm">
                <p className="font-medium">{u.name}</p>
                <p className="tnum text-muted">
                  {u.marcadosCount} · {formatMoney(u.marcadosFaturamento)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Section>
  )
}

function FaturamentoPorUnidade({ monthly, papel }: { monthly: UnitStat[]; papel: Acesso['papel'] }) {
  const semAcesso = monthly.length === 0
  const semMovimento = !semAcesso && monthly.every((u) => u.concluidos === 0 && u.faturamento === 0)
  const max = Math.max(1, ...monthly.map((u) => u.faturamento))

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
            {semAcesso ? (
              <tr>
                <td colSpan={3} className="text-muted p-8 text-center text-sm">
                  {papel === 'dona'
                    ? 'Nenhuma unidade ativa ainda.'
                    : 'Nenhuma loja atribuída a você ainda. Fale com a administração.'}
                </td>
              </tr>
            ) : semMovimento ? (
              <tr>
                <td colSpan={3} className="text-muted p-8 text-center text-sm">
                  Ainda sem atendimento concluído este mês.
                </td>
              </tr>
            ) : (
              monthly.map((unit) => (
                <tr
                  key={unit.id}
                  className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
                >
                  <td className="p-3.5">
                    <Link href={href(`/agenda/${unit.slug}`)} className="font-medium hover:underline">
                      {unit.name}
                    </Link>
                  </td>
                  <td className="tnum text-muted p-3.5 text-right">{unit.concluidos}</td>
                  <td className="p-3.5">
                    {/* A barra é a comparação — não é gráfico decorativo, é
                        a proporção entre unidades na própria linha. */}
                    <div className="flex items-center justify-end gap-3">
                      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-(--border-subtle) sm:w-24">
                        <span
                          className="block h-full rounded-full bg-(--accent)"
                          style={{ width: `${Math.round((unit.faturamento / max) * 100)}%` }}
                        />
                      </span>
                      <span className="tnum font-medium">{formatMoney(unit.faturamento)}</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
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
                <td colSpan={2} className="text-muted p-8 text-center text-sm">
                  Nenhuma comissão pendente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-right text-sm">
        <Link href="/admin/comissoes" className="text-(--text-strong) underline underline-offset-4">
          ver todas as comissões →
        </Link>
      </p>
    </Section>
  )
}
