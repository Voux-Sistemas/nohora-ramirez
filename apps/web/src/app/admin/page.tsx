import { addDaysInZone, isoDateInZone, zonedDateTime } from '@studio/core'
import { LIVE_APPOINTMENT_STATUSES, appointments, units } from '@studio/db'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { AdminShell, Section } from '@/components/admin/shell'
import { db } from '@/lib/db'
import { formatMoney, formatMoneyShort, formatMonthLong } from '@/lib/format'
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

interface Dashboard {
  unidades: UnitStat[]
  /** Faturamento de cada dia do mês, do dia 1 ao último — dias futuros ficam a 0. */
  serie: number[]
  diaAtual: number
  mesLabel: string
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
 * dias); uma segunda consulta devolve o mesmo mês partido por dia, que é a
 * forma do mês na tela.
 */
async function loadDashboard(acesso: Acesso): Promise<Dashboard> {
  const agora = new Date()
  const vazio: Dashboard = {
    unidades: [],
    serie: [],
    diaAtual: 0,
    mesLabel: '',
  }

  const todas = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  const rows = unidadesVisiveis(acesso, todas)
  if (rows.length === 0) return vazio

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

  /* O calendário do painel vem do primeiro fuso e os outros somam por cima:
     o mês de agosto tem os mesmos 31 dias em Lisboa e no Porto, e é a
     realidade do produto (todas as lojas em Portugal). */
  let serie: number[] = []
  let diaAtual = 0
  let mesLabel = ''

  for (const [timezone, unidadesDoFuso] of porFuso) {
    const hoje = isoDateInZone(agora, timezone)
    const [year, month, diaDoMes] = hoje.split('-').map(Number) as [number, number, number]

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
    const cutoffCandidate = addDaysInZone(prevMonthStartIso, diaDoMes)
    const prevPeriodEndIso = cutoffCandidate < monthStartIso ? cutoffCandidate : monthStartIso
    const em7DiasIso = addDaysInZone(hoje, 7)

    const monthStart = zonedDateTime(monthStartIso, '00:00', timezone)
    const monthEnd = zonedDateTime(nextMonthStartIso, '00:00', timezone)
    const prevMonthStart = zonedDateTime(prevMonthStartIso, '00:00', timezone)
    const prevPeriodEnd = zonedDateTime(prevPeriodEndIso, '00:00', timezone)
    const em7Dias = zonedDateTime(em7DiasIso, '00:00', timezone)

    /* `sql` template interpolation não passa pelo mapeamento de tipo da coluna
       que `gte`/`lt` fazem — o driver recebe o `Date` cru e quebra ao
       serializar o pacote ("must be of type string or an instance of Buffer").
       Dentro de `filter (where …)` isso só se resolve com string ISO. */
    const monthStartTs = monthStart.toISOString()
    const monthEndTs = monthEnd.toISOString()
    const prevMonthStartTs = prevMonthStart.toISOString()
    const prevPeriodEndTs = prevPeriodEnd.toISOString()
    const agoraTs = agora.toISOString()
    const em7DiasTs = em7Dias.toISOString()

    const ids = unidadesDoFuso.map((u) => u.id)

    if (serie.length === 0) {
      // dia 0 do mês seguinte = último dia deste mês
      const diasNoMes = new Date(Date.UTC(nextYear, nextMonth - 1, 0)).getUTCDate()
      serie = new Array<number>(diasNoMes).fill(0)
      diaAtual = diaDoMes
      mesLabel = formatMonthLong(monthStartIso)
    }

    const diaExpr = sql<number>`extract(day from (${appointments.startsAt} at time zone ${timezone}))::int`

    const [linhas, diarias] = await Promise.all([
      db
        .select({
          unitId: appointments.unitId,
          concluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${monthStartTs} and ${appointments.startsAt} < ${monthEndTs})::int`,
          faturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${monthStartTs} and ${appointments.startsAt} < ${monthEndTs}), 0)::int`,
          concluidosAnterior: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${prevMonthStartTs} and ${appointments.startsAt} < ${prevPeriodEndTs})::int`,
          faturamentoAnterior: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${prevMonthStartTs} and ${appointments.startsAt} < ${prevPeriodEndTs}), 0)::int`,
          marcadosCount: sql<number>`count(*) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agoraTs} and ${appointments.startsAt} < ${em7DiasTs})::int`,
          marcadosFaturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agoraTs} and ${appointments.startsAt} < ${em7DiasTs}), 0)::int`,
        })
        .from(appointments)
        .where(
          and(
            inArray(appointments.unitId, ids),
            gte(appointments.startsAt, prevMonthStart),
            lt(appointments.startsAt, em7Dias),
          ),
        )
        .groupBy(appointments.unitId),

      db
        .select({
          dia: diaExpr,
          valor: sql<number>`coalesce(sum(${appointments.totalPrice}), 0)::int`,
        })
        .from(appointments)
        .where(
          and(
            inArray(appointments.unitId, ids),
            eq(appointments.status, 'completed'),
            gte(appointments.startsAt, monthStart),
            lt(appointments.startsAt, monthEnd),
          ),
        )
        /*
          Ordinal, e não a expressão outra vez. `diaExpr` carrega o fuso como
          parâmetro; repeti-la no GROUP BY manda dois placeholders diferentes
          ($1 e $5) para o Postgres, que os trata como nós distintos e recusa
          a consulta com 42803 ("column must appear in the GROUP BY clause").
          Confirmado contra o banco antes de trocar.
        */
        .groupBy(sql`1`),
    ])

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

    for (const { dia, valor } of diarias) {
      const i = dia - 1
      if (i >= 0 && i < serie.length) serie[i] = (serie[i] ?? 0) + valor
    }
  }

  return {
    unidades: rows.map((unit) => porUnidade.get(unit.id) as UnitStat),
    serie,
    diaAtual,
    mesLabel,
  }
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
 * manhã. Este é o mês, e ele cabe em dois blocos: o mês em si (quanto entrou,
 * a forma dele dia a dia, e os quatro números que o acompanham) e onde ele
 * aconteceu (por unidade, e o que há a pagar).
 *
 * Eram cinco blocos empilhados numa coluna estreita, cada um com a sua frase
 * de explicação — a queixa de "informação a mais, e jogada". O que saiu não
 * foi informação: "Já marcado" deixou de ser um bloco inteiro e virou um
 * número no conjunto, com o detalhe por loja a viver na tabela, onde já havia
 * uma linha por unidade à espera dele.
 */
export default async function AdminPainelPage() {
  const acesso = await requireGestao()
  const rede = podeRede(acesso)

  const [{ unidades, serie, diaAtual, mesLabel }, commissions] = await Promise.all([
    loadDashboard(acesso),
    rede ? commissionSummaryByStaff() : Promise.resolve(null),
  ])

  const faturamento = unidades.reduce((acc, u) => acc + u.faturamento, 0)
  const faturamentoAnterior = unidades.reduce((acc, u) => acc + u.faturamentoAnterior, 0)
  const concluidos = unidades.reduce((acc, u) => acc + u.concluidos, 0)
  const concluidosAnterior = unidades.reduce((acc, u) => acc + u.concluidosAnterior, 0)
  const marcados = unidades.reduce((acc, u) => acc + u.marcadosFaturamento, 0)
  const marcadosCount = unidades.reduce((acc, u) => acc + u.marcadosCount, 0)
  const ticket = concluidos > 0 ? Math.round(faturamento / concluidos) : 0
  const ticketAnterior =
    concluidosAnterior > 0 ? Math.round(faturamentoAnterior / concluidosAnterior) : 0
  const comissoesPendentes = (commissions ?? []).reduce((acc, c) => acc + c.pendingAmount, 0)

  const pendentes = (commissions ?? [])
    .filter((c) => c.pendingAmount > 0)
    .sort((a, b) => b.pendingAmount - a.pendingAmount)
    .slice(0, 6)

  return (
    <AdminShell acesso={acesso} active="/admin" title="Painel" meta={mesLabel}>
      {/*
        Um bloco só para o mês. O faturamento manda — é o número pelo qual ela
        abre esta tela —, e por isso ocupa a maior parte da placa e leva a
        forma do mês debaixo dele. Os outros quatro acompanham numa coluna à
        direita: presentes, comparáveis, mas sem disputar o primeiro olhar.
      */}
      <div className="plate mb-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="p-6 lg:p-8">
          <p className="label-caps text-muted">Faturamento · {mesLabel}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="display tnum text-[2.75rem] leading-none xl:text-[3.25rem]">
              {formatMoneyShort(faturamento)}
            </p>
            <Variacao
              comparativo={{
                atual: faturamento,
                anterior: faturamentoAnterior,
              }}
            />
          </div>

          <MesDiaADia serie={serie} diaAtual={diaAtual} mesLabel={mesLabel} />
        </div>

        <dl className="divide-y divide-(--border-subtle) border-t border-(--border-subtle) lg:border-t-0 lg:border-l">
          <MetricaLinha
            label="Atendimentos"
            value={String(concluidos)}
            comparativo={{ atual: concluidos, anterior: concluidosAnterior }}
          />
          <MetricaLinha
            label="Ticket médio"
            value={formatMoney(ticket)}
            comparativo={{ atual: ticket, anterior: ticketAnterior }}
          />
          <MetricaLinha
            label="Próximos 7 dias"
            value={formatMoneyShort(marcados)}
            nota={`${marcadosCount} marcaç${marcadosCount === 1 ? 'ão' : 'ões'} de pé`}
          />
          {rede ? (
            <MetricaLinha
              label="Comissões"
              value={formatMoneyShort(comissoesPendentes)}
              // Saldo em aberto agora, não um fluxo do mês — comparar com "o
              // pendente no mesmo dia do mês passado" pediria reconstruir o
              // histórico de commissionEntries a partir de createdAt/paidAt,
              // que hoje a consulta não faz. Mostra o número tal como é.
              nota="por pagar, hoje"
            />
          ) : null}
        </dl>
      </div>

      <div
        className={cn(
          'grid grid-cols-1 gap-8',
          rede && 'xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
        )}
      >
        <PorUnidade unidades={unidades} papel={acesso.papel} />
        {rede ? <APagar pendentes={pendentes} /> : null}
      </div>
    </AdminShell>
  )
}

/** A seta e a percentagem, sempre contra o mesmo trecho do mês anterior. */
function Variacao({ comparativo }: { comparativo: Comparativo }) {
  const pct = variacaoPct(comparativo)
  if (pct === null) {
    return <span className="text-muted text-sm">primeiro mês com movimento</span>
  }
  return (
    <span className="text-sm">
      <span
        className={cn('tnum font-medium', pct >= 0 ? 'text-(--estado-bom)' : 'text-(--estado-mau)')}
      >
        {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
      </span>{' '}
      <span className="text-muted">vs. mês passado até hoje</span>
    </span>
  )
}

/**
 * O mês como forma, não como número: a dona vê num relance se a segunda
 * quinzena está a puxar, se houve um buraco na semana passada, e quanto do mês
 * ainda falta. É a mesma soma da placa ao lado, partida por dia.
 */
function MesDiaADia({
  serie,
  diaAtual,
  mesLabel,
}: {
  serie: number[]
  diaAtual: number
  mesLabel: string
}) {
  if (serie.length === 0) return null
  const max = Math.max(1, ...serie)
  const melhor = serie.indexOf(max) + 1

  return (
    <div className="mt-8">
      <div
        className="flex h-20 items-end gap-px xl:h-24"
        role="img"
        aria-label={
          max > 1
            ? `Faturamento dia a dia de ${mesLabel}. Melhor dia: ${melhor}, com ${formatMoney(max)}.`
            : `Ainda sem faturamento em ${mesLabel}.`
        }
      >
        {serie.map((valor, i) => {
          const dia = i + 1
          const futuro = dia > diaAtual
          return (
            <span
              key={dia}
              title={futuro ? `dia ${dia}` : `dia ${dia} — ${formatMoney(valor)}`}
              className={cn(
                'block min-h-px flex-1 rounded-t-[1px]',
                futuro
                  ? 'bg-(--border-subtle)/60'
                  : valor > 0
                    ? dia === diaAtual
                      ? 'bg-(--text-strong)'
                      : 'bg-(--accent)'
                    : 'bg-(--border-strong)',
              )}
              style={{
                height: futuro || valor === 0 ? '2px' : `${Math.max(4, (valor / max) * 100)}%`,
              }}
            />
          )
        })}
      </div>
      <div className="text-muted tnum mt-2 flex justify-between text-xs">
        <span>1</span>
        <span>{serie.length}</span>
      </div>
    </div>
  )
}

function MetricaLinha({
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
  return (
    <div className="flex-1 px-6 py-4 lg:px-6 lg:py-5">
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="tnum text-(--text-strong) text-xl leading-none font-medium">{value}</span>
        {comparativo ? (
          <PctCurto comparativo={comparativo} />
        ) : nota ? (
          <span className="text-muted text-xs">{nota}</span>
        ) : null}
      </dd>
    </div>
  )
}

function PctCurto({ comparativo }: { comparativo: Comparativo }) {
  const pct = variacaoPct(comparativo)
  if (pct === null) return <span className="text-muted text-xs">sem comparação</span>
  return (
    <span
      className={cn(
        'tnum text-xs font-medium',
        pct >= 0 ? 'text-(--estado-bom)' : 'text-(--estado-mau)',
      )}
    >
      {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

/**
 * Onde o mês aconteceu — e o que já está marcado em cada loja.
 *
 * A semana seguinte era um bloco à parte com o detalhe por unidade repetido ao
 * lado. Aqui ela é a última coluna da linha da loja, que é onde a comparação
 * entre lojas já estava a ser feita.
 */
function PorUnidade({ unidades, papel }: { unidades: UnitStat[]; papel: Acesso['papel'] }) {
  const semAcesso = unidades.length === 0
  const semMovimento = !semAcesso && unidades.every((u) => u.faturamento === 0)
  const max = Math.max(1, ...unidades.map((u) => u.faturamento))

  return (
    <Section title="Por unidade" className="mb-0">
      <div className="plate overflow-x-auto">
        <table className="w-full min-w-lg text-[0.9375rem]">
          <thead className="text-muted border-b border-(--border-subtle) text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Unidade</th>
              <th className="px-5 py-3 text-right font-medium">Atend.</th>
              <th className="px-5 py-3 text-right font-medium">Faturamento</th>
              <th className="px-5 py-3 text-right font-medium whitespace-nowrap">Próx. 7 dias</th>
            </tr>
          </thead>
          <tbody>
            {semAcesso || semMovimento ? (
              <tr>
                <td colSpan={4} className="text-muted px-5 py-10 text-center text-sm">
                  {semAcesso
                    ? papel === 'dona'
                      ? 'Nenhuma unidade ativa ainda.'
                      : 'Nenhuma loja atribuída a si ainda. Fale com a administração.'
                    : 'Ainda sem atendimento concluído este mês.'}
                </td>
              </tr>
            ) : (
              unidades.map((unit) => (
                <tr
                  key={unit.id}
                  className="border-b border-(--border-subtle) transition-colors last:border-0 hover:bg-(--surface-sunken)"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={href(`/agenda/${unit.slug}`)}
                      className="font-medium hover:underline"
                    >
                      {unit.name}
                    </Link>
                  </td>
                  <td className="tnum text-muted px-5 py-3.5 text-right">{unit.concluidos}</td>
                  <td className="px-5 py-3.5">
                    {/* A barra é a comparação — não é gráfico decorativo, é
                        a proporção entre unidades na própria linha. */}
                    <div className="flex items-center justify-end gap-3">
                      <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-(--border-subtle) lg:w-28">
                        <span
                          className="block h-full rounded-full bg-(--accent)"
                          style={{
                            width: `${Math.round((unit.faturamento / max) * 100)}%`,
                          }}
                        />
                      </span>
                      <span className="tnum font-medium">{formatMoney(unit.faturamento)}</span>
                    </div>
                  </td>
                  <td className="tnum text-muted px-5 py-3.5 text-right whitespace-nowrap">
                    {unit.marcadosCount > 0
                      ? `${unit.marcadosCount} · ${formatMoneyShort(unit.marcadosFaturamento)}`
                      : '—'}
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

function APagar({
  pendentes,
}: {
  pendentes: { staffId: string; staffName: string; pendingAmount: number }[]
}) {
  return (
    <Section
      title="A pagar"
      className="mb-0"
      actions={
        <Link
          href={href('/admin/comissoes')}
          className="text-muted hover:text-(--text-strong) transition-colors"
        >
          todas →
        </Link>
      }
    >
      <div className="plate">
        <ul>
          {pendentes.map((row) => (
            <li
              key={row.staffId}
              className="flex items-baseline justify-between gap-4 border-b border-(--border-subtle) px-5 py-3.5 text-[0.9375rem] last:border-0"
            >
              <span>{row.staffName}</span>
              <span className="tnum font-medium">{formatMoney(row.pendingAmount)}</span>
            </li>
          ))}
          {pendentes.length === 0 ? (
            <li className="text-muted px-5 py-10 text-center text-sm">Nada por pagar.</li>
          ) : null}
        </ul>
      </div>
    </Section>
  )
}
