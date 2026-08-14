import { addDaysInZone, zonedDateTime, type TimeRange } from '@studio/core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  APPOINTMENT_ANCHOR_PREFIX,
  DayGrid,
  NOW_MARKER_ID,
  boardMaxWidthRem,
  type GridColumn,
} from '@/components/agenda/day-grid'
import { AppointmentPanel, STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { RolarParaAgora } from '@/components/agenda/rolar-para-agora'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { buttonVariants } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { pais } from '@/lib/pais'
import { cn, href } from '@/lib/utils'
import { podeGerir, requireAcesso, requireUnidade } from '@/server/auth/permissoes'
import { todayInUnit } from '@/server/scheduling/availability'
import { getUnitBySlug, loadBookingContext } from '@/server/scheduling/context'
import { countDay, listDayAppointments, type AppointmentView } from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'

const HOUR_MS = 3_600_000
const CANCELLED = new Set(['cancelled_by_client', 'cancelled_by_studio', 'no_show'])

export default async function AgendaDoDiaPage({
  params,
  searchParams,
}: {
  params: Promise<{ unidade: string }>
  searchParams: Promise<{ d?: string; sel?: string }>
}) {
  const { unidade } = await params
  const { d, sel } = await searchParams

  const acesso = await requireAcesso()
  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()
  requireUnidade(acesso, unit.id)

  const gerir = podeGerir(acesso)

  const today = todayInUnit(unit)
  const date = isValidDate(d) ? d : today
  const [ctx, todos] = await Promise.all([
    loadBookingContext({ unit, fromDate: date, toDate: date }),
    listDayAppointments(unit, date),
  ])

  /*
    A prancheta da profissional é a dela e mais nada.
    O recorte é por atendimento, não por coluna: a cliente que fez escova com
    uma e coloração com outra aparece inteira para as duas — é o mesmo horário,
    e esconder metade dele faria a agenda mentir sobre quando ela sai. O que a
    profissional não vê é quem mais está escalado, e por isso não sabe quem tem
    buraco na tarde. Mover cliente entre colunas é da gerência.
  */
  const appointments = gerir ? todos : soDaProfissional(todos, acesso.staffId)

  const live = appointments.filter((item) => !CANCELLED.has(item.status))
  const cancelled = appointments.filter((item) => CANCELLED.has(item.status))
  const counters = countDay(appointments)

  const columns = buildColumns(ctx, live, gerir ? null : acesso.staffId)
  const openRanges = ctx.openRangesByDate.get(date) ?? []
  const { from, to } = drawWindow(openRanges, live, date, unit.timezone)

  const baseHref = `/agenda/${unit.slug}?d=${date}`
  const selected = sel ? (appointments.find((item) => item.id === sel) ?? null) : null

  /*
    Para onde a tela rola sozinha ao abrir. "Agora" só é honesto quando a data
    aberta é hoje e a hora corrente cai dentro da janela desenhada — fora
    disso, mira no primeiro item do dia (não no primeiro atendimento: um
    atendimento com dois serviços em cadeiras diferentes gera dois blocos, e o
    alvo precisa ser um id que existe de verdade num só lugar da tela).
  */
  const now = new Date()
  const agoraNaTela = now.getTime() >= from.getTime() && now.getTime() < to.getTime()
  const primeiroItem = live
    .flatMap((appointment) => appointment.items.map((item) => ({ id: item.id, start: item.start })))
    .reduce<{ id: string; start: Date } | null>(
      (min, item) => (min === null || item.start < min.start ? item : min),
      null,
    )
  const alvoRolagem = agoraNaTela
    ? NOW_MARKER_ID
    : primeiroItem
      ? `${APPOINTMENT_ANCHOR_PREFIX}${primeiroItem.id}`
      : null

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Dia que já passou não muda mais — ali o tique seria só gasto. */}
      <AtualizaSozinho ativo={date >= today} />
      {/* `key={date}`: reaparece a cada dia aberto, mas ignora as
          atualizações automáticas da própria tela — ver o componente. */}
      <RolarParaAgora key={date} alvo={alvoRolagem} />

      {/*
        O cabeçalho tem a medida da grade, não a da tela.
        Ele era `justify-between` dentro de 1400px enquanto a prancheta de duas
        profissionais mede 632: título num canto, botões no outro, e setecentos
        pixels de nada no meio ligando as duas coisas. `boardMaxWidthRem` é a
        mesma conta que `DayGrid` usa para as próprias colunas — antes eram
        dois cálculos, e um arredondava para cima de 2 mesmo num dia de uma
        profissional só, deixando o cabeçalho mais largo que a grade. Com uma
        conta só, o "Encaixar" sempre cai sobre a borda direita da última
        coluna de verdade. `Math.max(…, 1)` é só o piso para o dia sem
        ninguém escalado, onde `DayGrid` nem chega a desenhar a grade.
      */}
      <header className="mb-5" style={{ maxWidth: `${boardMaxWidthRem(Math.max(columns.length, 1))}rem` }}>
        <div>
          {/* Quem trabalha numa loja só não tem para onde voltar: `/agenda` a
              devolveria para cá. Link que dá em si mesmo é ruído. */}
          {acesso.unidadeIds !== null && acesso.unidadeIds.length <= 1 ? null : (
            <Link href="/agenda" className="text-muted text-sm hover:underline">
              ← unidades
            </Link>
          )}
          <h1 className="display mt-1 text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">
            {unit.name}
          </h1>

          {/*
            O resumo do dia é uma frase, não cinco placas.
            Eram cinco caixas iguais em cima da grade, empurrando a agenda para
            baixo da dobra — e a agenda é a tela. Vira uma linha do tamanho do
            texto, e "cancelados" só aparece quando existe: um zero permanente
            não é informação, é ruído com a mesma altura de tudo o mais.
          */}
          <p className="text-body mt-2 text-sm">
            <Num>{counters.reserved}</Num> na agenda
            {counters.completed > 0 ? (
              <>
                {' · '}
                <Num>{counters.completed}</Num> concluído{counters.completed === 1 ? '' : 's'}
              </>
            ) : null}
            {counters.cancelled > 0 ? (
              <>
                {' · '}
                <Num>{counters.cancelled}</Num> cancelado{counters.cancelled === 1 ? '' : 's'}
              </>
            ) : null}
            {/* O caixa do dia é da loja, não da cadeira: some para quem atende.
                O que ela ganha é comissão, e comissão tem tela própria. */}
            {gerir ? (
              <>
                {' · '}
                <Num>{formatMoney(counters.revenue)}</Num> no caixa
                {counters.expected > counters.revenue ? (
                  <>
                    {' de '}
                    <span className="tnum">{formatMoney(counters.expected)}</span> previstos
                  </>
                ) : null}
              </>
            ) : null}
          </p>
        </div>

        {/*
          A data é o rótulo entre as setas, e não uma linha de apoio embaixo do
          título repetida depois dentro do seletor. É o mesmo navegador de dia
          das telas de encaixe e de remarcação — três lugares do sistema em que
          se anda no calendário, um só desenho.

          "hoje" só existe quando não é hoje: um botão que não faz nada é ruído
          com o mesmo peso de um que faz. E as setas levam nome, porque
          sozinhas um leitor de tela anuncia "seta para a esquerda", que não diz
          para onde ela leva.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href={`/agenda/${unit.slug}?d=${addDaysInZone(date, -1)}`}
            aria-label="Dia anterior"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'px-2.5')}
          >
            ←
          </Link>
          <span className="text-sm font-medium">{formatDateLong(date)}</span>
          <Link
            href={`/agenda/${unit.slug}?d=${addDaysInZone(date, 1)}`}
            aria-label="Próximo dia"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'px-2.5')}
          >
            →
          </Link>
          {date === today ? null : (
            <Link
              href={`/agenda/${unit.slug}`}
              className="text-muted hover:text-(--text-strong) px-1 text-sm transition-colors"
            >
              hoje
            </Link>
          )}

          <form action={`/agenda/${unit.slug}`} className="ml-auto flex items-center gap-2">
            <label htmlFor="ir-para-dia" className="sr-only">
              Ir para uma data
            </label>
            <input
              id="ir-para-dia"
              type="date"
              name="d"
              defaultValue={date}
              className="h-9 rounded-lg border border-(--border-subtle) bg-(--surface-raised) px-2 text-sm"
            />
            <button className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>Ir</button>
          </form>

          {/* Encaixar é escolher em qual cadeira a cliente senta — e para isso
              é preciso enxergar todas. Fica com quem enxerga. */}
          {gerir ? (
            <Link
              href={`/agenda/${unit.slug}/encaixe?d=${date}`}
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              Encaixar
            </Link>
          ) : null}
        </div>
      </header>

      {/*
        `auto`, não `1fr`, e a grade não estica.
        Com `1fr` a coluna da prancheta engolia todo o espaço livre e a ficha da
        cliente ia parar na outra ponta da tela — meio palmo de nada entre o
        bloco que se clica e o painel que ele abre, quando os dois são a mesma
        ação. Em `auto` com `justify-start` a ficha encosta na grade. Quando a
        equipe é grande a coluna passa do espaço, o `min-w-0` deixa ela encolher
        e a prancheta rola por dentro, como já rolava.
      */}
      <div className={cn('grid gap-5', selected && 'lg:grid-cols-[auto_22rem] lg:justify-start')}>
        <div className="min-w-0">
          {columns.length === 0 ? (
            <p className="surface rounded-card text-muted p-6 text-sm">
              {gerir ? 'Ninguém escalado neste dia.' : 'Não está escalada neste dia.'}
            </p>
          ) : (
            <DayGrid
              timezone={unit.timezone}
              from={from}
              to={to}
              openRanges={openRanges}
              columns={columns}
              appointments={live}
              baseHref={baseHref}
              {...(sel ? { selectedId: sel } : {})}
            />
          )}

          {cancelled.length > 0 ? (
            <section className="mt-5">
              <h2 className="text-muted mb-2 text-sm">Cancelados e faltas</h2>
              <ul className="surface rounded-card divide-y divide-(--border-subtle)">
                {cancelled.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={href(`${baseHref}&sel=${item.id}`)}
                      scroll={false}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm hover:bg-(--surface-sunken)"
                    >
                      <span>
                        <span className="tnum text-muted mr-2">
                          {formatTime(item.start, unit.timezone)}
                        </span>
                        {item.clientName}
                      </span>
                      {/*
                        Faltou e cancelou não são o mesmo aviso: uma é a loja
                        perdendo o horário sem ter sido avisada. O ponto marca
                        a diferença para quem varre a lista rápido; o texto
                        continua a dizer a mesma coisa para quem lê devagar ou
                        usa leitor de tela.
                      */}
                      <span className="text-muted flex shrink-0 items-center gap-1.5 text-xs">
                        <span
                          aria-hidden
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            item.status === 'no_show' ? 'bg-(--estado-aviso)' : 'bg-(--border-strong)',
                          )}
                        />
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {selected ? (
          <AppointmentPanel
            appointment={selected}
            timezone={unit.timezone}
            closeHref={baseHref}
            unitSlug={unit.slug}
            gerir={gerir}
          />
        ) : null}
      </div>
    </main>
  )
}

/** Número dentro da frase do dia: mesmo corpo do texto, só mais tinta. */
function Num({ children }: { children: React.ReactNode }) {
  return <strong className="tnum text-(--text-strong) font-medium">{children}</strong>
}

/** Os atendimentos em que esta profissional executa pelo menos um serviço. */
function soDaProfissional(
  list: readonly AppointmentView[],
  staffId: string | null,
): AppointmentView[] {
  /* Sem perfil de agenda não há coluna nem atendimento — lista vazia é a
     resposta honesta, e não "então mostra tudo". */
  if (!staffId) return []
  return list.filter((item) => item.items.some((entry) => entry.staffId === staffId))
}

/**
 * Uma coluna por profissional escalado — mais quem tem atendimento no dia.
 *
 * `apenas` recorta a prancheta a uma pessoa. Não é filtro de tela: as colunas
 * das colegas nem chegam ao navegador.
 */
function buildColumns(
  ctx: Awaited<ReturnType<typeof loadBookingContext>>,
  live: readonly AppointmentView[],
  apenas: string | null,
): GridColumn[] {
  const withWork = new Set(live.flatMap((item) => item.items.map((entry) => entry.staffId)))

  return ctx.staff
    .filter((person) => (apenas === null ? true : person.staffId === apenas))
    .filter((person) => person.workingRanges.length > 0 || withWork.has(person.staffId))
    .map((person) => {
      const staff = ctx.staffInfo.get(person.staffId)
      return staff ? { staff, working: person.workingRanges } : null
    })
    .filter((column): column is GridColumn => column !== null)
    .sort((a, b) => a.staff.name.localeCompare(b.staff.name, pais().locale))
}

/**
 * Janela desenhada: o horário da unidade, esticado para caber atendimento que
 * comece antes ou termine depois (encaixe fora do expediente acontece).
 */
function drawWindow(
  openRanges: readonly TimeRange[],
  live: readonly AppointmentView[],
  date: string,
  timezone: string,
): { from: Date; to: Date } {
  const starts = [...openRanges.map((r) => r.start), ...live.map((a) => a.start)]
  const ends = [...openRanges.map((r) => r.end), ...live.map((a) => a.end)]

  if (starts.length === 0) {
    // dia fechado e sem nada marcado: a grade ainda precisa de altura
    const from = zonedDateTime(date, '08:00', timezone)
    return { from, to: new Date(from.getTime() + 12 * HOUR_MS) }
  }

  const from = new Date(Math.floor(Math.min(...starts.map((d) => d.getTime())) / HOUR_MS) * HOUR_MS)
  const to = new Date(Math.ceil(Math.max(...ends.map((d) => d.getTime())) / HOUR_MS) * HOUR_MS)
  return { from, to }
}

function isValidDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
