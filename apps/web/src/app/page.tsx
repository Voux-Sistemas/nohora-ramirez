import { addDaysInZone, agruparPorFuso, isoDateInZone, janelaDoMes, zonedDateTime } from '@studio/core'
import { LIVE_APPOINTMENT_STATUSES, appointments, units } from '@studio/db'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { OperateTopbar } from '@/components/operate/topbar'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { Photo } from '@/components/ui/photo'
import { Section } from '@/components/ui/section'
import { db } from '@/lib/db'
import { formatMoney, formatMoneyShort, formatMonthLong } from '@/lib/format'
import { pais } from '@/lib/pais'
import { cn, href } from '@/lib/utils'
import {
  podeRede,
  requireGestaoOuMontra,
  unidadesVisiveis,
  type Acesso,
} from '@/server/auth/permissoes'
import { commissionSummaryByStaff } from '@/server/finance/commissions'

export const dynamic = 'force-dynamic'

/** Uma loja com as duas janelas que a dona olha: o dia e o mês. */
interface UnidadePainel {
  id: string
  name: string
  slug: string
  district: string | null
  imageUrl: string | null
  /* o dia */
  hojeAgendados: number
  hojeConcluidos: number
  hojeCaixa: number
  hojePrevisto: number
  /* o mês */
  faturamento: number
  concluidos: number
  faturamentoAnterior: number
  concluidosAnterior: number
  marcadosCount: number
  marcadosFaturamento: number
}

interface Painel {
  unidades: UnidadePainel[]
  /** Faturação de cada dia do mês, do dia 1 ao último — dias futuros ficam a 0. */
  serie: number[]
  diaAtual: number
  mesLabel: string
}

interface Comparativo {
  atual: number
  anterior: number
}

/** Enum já validado no schema — junta os valores num IN() literal em vez de
 *  parametrizar um array, que pediria `= any()` explícito no driver. */
const STATUSES_AINDA_VALEM = sql.raw(
  LIVE_APPOINTMENT_STATUSES.map((status) => `'${status}'`).join(', '),
)

/**
 * Tudo o que o painel mostra, em duas consultas por fuso horário.
 *
 * Eram duas telas com dois carregadores: `loadToday` abria **uma consulta por
 * unidade** para somar o dia, e `loadDashboard` abria mais duas para somar o
 * mês. Com três lojas isso era seis idas ao banco para responder a perguntas
 * que a mesma linha de `appointments` responde de uma vez — o dia de hoje está
 * inteiro dentro da janela do mês, portanto é mais um `filter (where ...)` na
 * consulta que já existia, não outra consulta.
 *
 * Sobram duas por fuso: os números por loja, e o mês partido por dia. Na prática
 * duas ao todo, porque as lojas estão todas em Portugal.
 */
async function loadPainel(acesso: Acesso): Promise<Painel> {
  const agora = new Date()
  const vazio: Painel = { unidades: [], serie: [], diaAtual: 0, mesLabel: '' }

  const todas = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  /* O recorte vem antes das contagens, não depois: somar o dia de uma loja para
     esconder o número na tela ainda é ler o caixa de quem não é seu. */
  const rows = unidadesVisiveis(acesso, todas)
  if (rows.length === 0) return vazio

  const porUnidade = new Map<string, UnidadePainel>(
    rows.map((unit) => [
      unit.id,
      {
        id: unit.id,
        name: unit.name,
        slug: unit.slug,
        district: unit.district,
        imageUrl: unit.imageUrl,
        hojeAgendados: 0,
        hojeConcluidos: 0,
        hojeCaixa: 0,
        hojePrevisto: 0,
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

  for (const [timezone, doFuso] of agruparPorFuso(rows)) {
    const mes = janelaDoMes(agora, timezone)
    const hoje = isoDateInZone(agora, timezone)

    /*
      O fim do dia é a meia-noite seguinte no calendário, e não "mais 24 horas".
      A conta antiga somava 86 400 000 ms ao início do dia; na madrugada em que
      o relógio muda, o dia tem 23 ou 25 horas, e o caixa de domingo acabava
      uma hora cedo ou tarde — silenciosamente, no único dia do ano em que
      ninguém confere.
    */
    const diaInicio = zonedDateTime(hoje, '00:00', timezone).toISOString()
    const diaFim = zonedDateTime(addDaysInZone(hoje, 1), '00:00', timezone).toISOString()

    /* Os próximos sete dias começam agora, não à meia-noite: o que ela quer
       saber é o que ainda está por atender. */
    const em7Dias = zonedDateTime(addDaysInZone(hoje, 7), '00:00', timezone)
    const agoraTs = agora.toISOString()
    const em7DiasTs = em7Dias.toISOString()

    const ids = doFuso.map((unit) => unit.id)

    if (serie.length === 0) {
      serie = new Array<number>(mes.dias).fill(0)
      diaAtual = mes.diaDoMes
      mesLabel = formatMonthLong(mes.inicioIso)
    }

    const diaExpr = sql<number>`extract(day from (${appointments.startsAt} at time zone ${timezone}))::int`

    const [linhas, diarias] = await Promise.all([
      db
        .select({
          unitId: appointments.unitId,

          /* Cancelado e falta não são agenda: contá-los inflava tanto o número
             de visitas quanto o previsto. O enum não tem um valor 'cancelled'
             genérico — são três — então quem manda aqui é a lista de status
             que de facto ainda ocupam o horário. */
          hojeAgendados: sql<number>`count(*) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim})::int`,
          hojeConcluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim})::int`,
          hojeCaixa: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim}), 0)::int`,
          /* O que o dia vale se ninguém faltar. É a pergunta que ela faz de
             manhã. */
          hojePrevisto: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${diaInicio} and ${appointments.startsAt} < ${diaFim}), 0)::int`,

          concluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs})::int`,
          faturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs}), 0)::int`,
          concluidosAnterior: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.anteriorInicioTs} and ${appointments.startsAt} < ${mes.anteriorFimTs})::int`,
          faturamentoAnterior: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.anteriorInicioTs} and ${appointments.startsAt} < ${mes.anteriorFimTs}), 0)::int`,
          marcadosCount: sql<number>`count(*) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agoraTs} and ${appointments.startsAt} < ${em7DiasTs})::int`,
          marcadosFaturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} in (${STATUSES_AINDA_VALEM}) and ${appointments.startsAt} >= ${agoraTs} and ${appointments.startsAt} < ${em7DiasTs}), 0)::int`,
        })
        .from(appointments)
        .where(
          and(
            inArray(appointments.unitId, ids),
            gte(appointments.startsAt, mes.anteriorInicio),
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
            gte(appointments.startsAt, mes.inicio),
            lt(appointments.startsAt, mes.fim),
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
      atual.hojeAgendados = linha.hojeAgendados
      atual.hojeConcluidos = linha.hojeConcluidos
      atual.hojeCaixa = linha.hojeCaixa
      atual.hojePrevisto = linha.hojePrevisto
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
    unidades: rows.map((unit) => porUnidade.get(unit.id) as UnidadePainel),
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
 * O painel da dona — o dia e o mês na mesma tela.
 *
 * Eram dois. `/` mostrava a pauta do dia com uma placa do mês ao lado e um
 * "ver painel completo →"; `/admin` mostrava o mês outra vez, com mais casas
 * decimais e uma segunda tabela por unidade. A mesma pergunta partida ao meio,
 * cada metade atrás de um separador diferente da barra de cima — e uma delas
 * chamada "Gestão", que é onde ninguém procura um número.
 *
 * Aqui é uma tela só, e a ordem é a do olhar: o dia em números na primeira
 * linha, o mês inteiro na placa larga logo abaixo, e as lojas por baixo — cada
 * loja com o dia dela e, na mesma linha, quanto já pôs no mês. A tabela "por
 * unidade" do painel antigo desapareceu porque era esta mesma lista com outra
 * janela; agora as duas janelas vivem na mesma linha, que é o único sítio onde
 * se conseguem comparar sem decorar números.
 *
 * A moldura é a mesma 90rem da barra e da gestão. A pauta antiga vivia em
 * `max-w-6xl` com a placa do mês encostada — sobravam duas margens vazias num
 * ecrã de trabalho, que era a queixa do espaço em branco.
 */
export default async function PainelPage() {
  /* A página mostra faturação das lojas. Antes era pública: qualquer um com o
     endereço lia o caixa da rede. Hoje ela é da dona e do gerente — quem atende
     é levado para a própria agenda, que é o "hoje" dela. */
  const acesso = await requireGestaoOuMontra()
  const rede = podeRede(acesso)

  const [{ unidades, serie, diaAtual, mesLabel }, commissions] = await Promise.all([
    loadPainel(acesso),
    rede ? commissionSummaryByStaff() : Promise.resolve(null),
  ])

  const hoje = unidades.reduce(
    (acc, unit) => ({
      agendados: acc.agendados + unit.hojeAgendados,
      concluidos: acc.concluidos + unit.hojeConcluidos,
      caixa: acc.caixa + unit.hojeCaixa,
      previsto: acc.previsto + unit.hojePrevisto,
    }),
    { agendados: 0, concluidos: 0, caixa: 0, previsto: 0 },
  )

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

  const maxMes = Math.max(1, ...unidades.map((u) => u.faturamento))
  const data = new Date().toLocaleDateString(pais().locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <>
      <OperateTopbar acesso={acesso} active="hoje" />

      <main className="mx-auto w-full max-w-[90rem] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {/* A pauta do dia é o painel que fica aberto num canto da recepção o dia
            inteiro. Congelado no estado das nove da manhã ele mente. */}
        <AtualizaSozinho />

        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            {/* "na rede" só é verdade para quem tem a rede. Para o gerente de
                uma loja o título seria uma promessa que a pauta não cumpre. */}
            <h1 className="display text-[1.75rem] leading-[1.1] font-normal sm:text-[2rem]">
              {acesso.papel === 'dona' ? 'Hoje na rede' : 'Hoje'}
            </h1>
            <p className="text-muted mt-1 text-sm first-letter:uppercase">{data}</p>
          </div>

          {/*
            O dia é uma frase, não um mostrador. Quatro números grandes no topo
            seriam o template de métrica que toda a ferramenta faz — e aqui
            disputariam o olhar com a faturação do mês, que está logo abaixo em
            corpo 44. Quem manda no espaço é a placa; o dia diz-se a falar.
          */}
          {unidades.length > 0 ? (
            <p className="text-body text-sm">
              <strong className="tnum text-(--text-strong) font-medium">{hoje.agendados}</strong>{' '}
              {hoje.agendados === 1 ? 'visita' : 'visitas'} ·{' '}
              <strong className="tnum text-(--text-strong) font-medium">
                {formatMoney(hoje.caixa)}
              </strong>{' '}
              no caixa
              {hoje.previsto > hoje.caixa ? (
                <>
                  {' '}
                  de <span className="tnum">{formatMoney(hoje.previsto)}</span> previstos
                </>
              ) : null}
            </p>
          ) : null}
        </header>

        {unidades.length === 0 ? (
          <p className="plate text-muted px-6 py-12 text-center text-sm">
            {acesso.papel === 'dona' ? (
              <>
                Nenhuma unidade ativa. Registe a primeira em{' '}
                <Link
                  href={href('/admin/unidades')}
                  className="text-(--text-strong) underline underline-offset-4"
                >
                  Unidades
                </Link>
                .
              </>
            ) : (
              /* Mandar o gerente para uma tela que ele não abre seria pior do
                 que não dizer nada. Quem cadastra unidade é a dona. */
              'Nenhuma loja atribuída a si ainda. Fale com a administração.'
            )}
          </p>
        ) : (
          <>
            {/*
              Um bloco só para o mês. A faturação manda — é o número pelo qual
              ela abre esta tela — e por isso ocupa a maior parte da placa e
              leva a forma do mês debaixo dele. Os outros acompanham numa coluna
              à direita: presentes, comparáveis, sem disputar o primeiro olhar.
            */}
            <div className="plate mb-9 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="p-6 lg:p-8">
                <p className="label-caps text-muted">Faturação · {mesLabel}</p>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <p className="display tnum text-[2.75rem] leading-none xl:text-[3.25rem]">
                    {formatMoneyShort(faturamento)}
                  </p>
                  <Variacao comparativo={{ atual: faturamento, anterior: faturamentoAnterior }} />
                </div>

                <MesDiaADia serie={serie} diaAtual={diaAtual} mesLabel={mesLabel} />
              </div>

              {/* Coluna em flex e não só `divide-y`: com três métricas em vez de
                  quatro, as linhas paravam a meio e o resto da placa ficava
                  branco ao lado do gráfico. Assim ocupam a altura que têm. */}
              <dl className="flex flex-col divide-y divide-(--border-subtle) border-t border-(--border-subtle) lg:border-t-0 lg:border-l">
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
                    // Saldo em aberto agora, não um fluxo do mês — comparar com
                    // "o pendente no mesmo dia do mês passado" pediria
                    // reconstruir o histórico de commissionEntries a partir de
                    // createdAt/paidAt, que hoje a consulta não faz.
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
              <Section title="As lojas" className="mb-0">
                <div className="plate">
                  {unidades.map((unit) => (
                    <LojaLinha key={unit.id} unit={unit} maxMes={maxMes} />
                  ))}
                </div>
              </Section>

              {rede ? <APagar pendentes={pendentes} /> : null}
            </div>
          </>
        )}
      </main>
    </>
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
            ? `Faturação dia a dia de ${mesLabel}. Melhor dia: ${melhor}, com ${formatMoney(max)}.`
            : `Ainda sem faturação em ${mesLabel}.`
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
    <div className="flex flex-1 flex-col justify-center px-6 py-4 lg:py-5">
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
 * Uma loja: o dia dela, e o que já pôs no mês.
 *
 * Era duas linhas em duas telas — a pauta de `/` com os números de hoje, e a
 * tabela "por unidade" de `/admin` com os do mês. A mesma loja, o mesmo nome, o
 * mesmo link para a mesma agenda. Aqui é uma linha só, e a coluna do mês entra
 * a partir de `lg`, separada por um fio: onde não há largura para as duas
 * janelas, quem fica é o dia — é isso que se abre de manhã ao balcão.
 *
 * A foto entra pequena e à esquerda, do tamanho de uma etiqueta. Serve para
 * reconhecer a loja de relance — a dona não lê "Valongo", ela vê a sala. É a
 * mesma fotografia que a cliente vê grande no agendamento.
 */
function LojaLinha({ unit, maxMes }: { unit: UnidadePainel; maxMes: number }) {
  const restantes = unit.hojeAgendados - unit.hojeConcluidos

  return (
    <Link
      href={href(`/agenda/${unit.slug}`)}
      className="group flex items-center gap-4 border-b border-(--border-subtle) px-5 py-4 transition-colors last:border-0 hover:bg-(--surface-sunken) sm:gap-5"
    >
      <Photo
        src={unit.imageUrl}
        alt=""
        name={unit.name}
        sizes="64px"
        className="aspect-square w-12 shrink-0 sm:w-14"
        interactive
      />

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium">{unit.name}</h3>
        <p className="text-muted truncate text-sm">
          {unit.district ?? '—'}
          <span className="hidden sm:inline">
            {' · '}
            {restantes === 0 ? 'dia encerrado' : `${restantes} por atender`}
          </span>
        </p>
      </div>

      {/*
        Os números alinham à direita e em largura fixa para as linhas formarem
        coluna — é o que faz a lista ser lida de cima para baixo, que é como se
        compara loja com loja.
      */}
      <dl className="flex shrink-0 items-baseline gap-5 sm:gap-7">
        <Numero label="agenda" value={String(unit.hojeAgendados)} />
        <Numero label="feitos" value={String(unit.hojeConcluidos)} />
        <Numero label="caixa" value={formatMoney(unit.hojeCaixa)} wide />
      </dl>

      <div className="hidden shrink-0 items-center gap-3 border-l border-(--border-subtle) pl-5 lg:flex xl:pl-6">
        {/* A barra é a comparação — não é gráfico decorativo, é a proporção
            entre lojas na própria linha. */}
        <span className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-(--border-subtle) xl:w-24">
          <span
            className="block h-full rounded-full bg-(--accent)"
            style={{ width: `${Math.round((unit.faturamento / maxMes) * 100)}%` }}
          />
        </span>
        <Numero label="no mês" value={formatMoney(unit.faturamento)} wide />
      </div>

      <span
        aria-hidden
        className="text-muted group-hover:text-(--text-strong) hidden transition-[color,transform] group-hover:translate-x-0.5 sm:inline"
      >
        →
      </span>
    </Link>
  )
}

function Numero({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'w-24 text-right sm:w-28' : 'w-10 text-right sm:w-12'}>
      <dd className="tnum text-(--text-strong) text-lg leading-none font-medium sm:text-xl">
        {value}
      </dd>
      <dt className="text-muted mt-1 text-xs">{label}</dt>
    </div>
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
