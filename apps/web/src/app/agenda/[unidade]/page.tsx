import { addDaysInZone, zonedDateTime, type TimeRange } from '@studio/core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DayGrid, type GridColumn } from '@/components/agenda/day-grid'
import { AppointmentPanel, STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { buttonVariants } from '@/components/ui/button'
import { formatBRL, formatDateLong, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
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

  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()

  const today = todayInUnit(unit)
  const date = isValidDate(d) ? d : today
  const [ctx, appointments] = await Promise.all([
    loadBookingContext({ unit, fromDate: date, toDate: date }),
    listDayAppointments(unit, date),
  ])

  const live = appointments.filter((item) => !CANCELLED.has(item.status))
  const cancelled = appointments.filter((item) => CANCELLED.has(item.status))
  const counters = countDay(appointments)

  const columns = buildColumns(ctx, live)
  const openRanges = ctx.openRangesByDate.get(date) ?? []
  const { from, to } = drawWindow(openRanges, live, date, unit.timezone)

  const baseHref = `/agenda/${unit.slug}?d=${date}`
  const selected = sel ? (appointments.find((item) => item.id === sel) ?? null) : null

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/*
        O cabeçalho tem a medida da grade, não a da tela.
        Ele era `justify-between` dentro de 1400px enquanto a prancheta de duas
        profissionais mede 632: título num canto, botões no outro, e setecentos
        pixels de nada no meio ligando as duas coisas. A largura da grade é
        conhecida — `3.5rem` da régua mais `18rem` por coluna — então o
        cabeçalho toma exatamente essa medida e o "Encaixar" cai sobre a borda
        direita da última coluna. Vira um objeto só.
      */}
      <header className="mb-5" style={{ maxWidth: `${3.5 + 18 * Math.max(columns.length, 2)}rem` }}>
        <div>
          <Link href="/agenda" className="text-muted text-sm hover:underline">
            ← unidades
          </Link>
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
            {' · '}
            <Num>{formatBRL(counters.revenue)}</Num> no caixa
            {counters.expected > counters.revenue ? (
              <>
                {' de '}
                <span className="tnum">{formatBRL(counters.expected)}</span> previstos
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

          <Link
            href={`/agenda/${unit.slug}/encaixe?d=${date}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Encaixar
          </Link>
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
              Ninguém escalado neste dia.
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
                      <span className="text-muted shrink-0 text-xs">
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

/** Uma coluna por profissional escalado — mais quem tem atendimento no dia. */
function buildColumns(
  ctx: Awaited<ReturnType<typeof loadBookingContext>>,
  live: readonly AppointmentView[],
): GridColumn[] {
  const withWork = new Set(live.flatMap((item) => item.items.map((entry) => entry.staffId)))

  return ctx.staff
    .filter((person) => person.workingRanges.length > 0 || withWork.has(person.staffId))
    .map((person) => {
      const staff = ctx.staffInfo.get(person.staffId)
      return staff ? { staff, working: person.workingRanges } : null
    })
    .filter((column): column is GridColumn => column !== null)
    .sort((a, b) => a.staff.name.localeCompare(b.staff.name, 'pt-BR'))
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
