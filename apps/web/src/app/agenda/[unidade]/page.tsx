import { isIsoDate, isoDateInZone, zonedDateTime, type TimeRange } from '@studio/core'
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
import { DayList, LISTA_ANCHOR_PREFIX, LISTA_NOW_MARKER_ID } from '@/components/agenda/day-list'
import { NavegadorDeDia } from '@/components/agenda/navegador-de-dia'
import { RolarParaAgora } from '@/components/agenda/rolar-para-agora'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { buttonVariants } from '@/components/ui/button'
import { formatDateShort, formatMoney, formatTime } from '@/lib/format'
import { pais } from '@/lib/pais'
import { cn, href } from '@/lib/utils'
import { podeGerir, requireAcesso, requireUnidade } from '@/server/auth/permissoes'
import { dadosDeConfirmacao } from '@/server/notifications/confirmacao'
import { todayInUnit } from '@/server/scheduling/availability'
import { getUnitBySlug, loadBookingContext } from '@/server/scheduling/context'
import {
  CANCELADOS,
  countDay,
  listDayAppointments,
  soDaProfissional,
  type AppointmentView,
} from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'

const HOUR_MS = 3_600_000

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
  const date = isIsoDate(d) ? d : today
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

  const live = appointments.filter((item) => !CANCELADOS.has(item.status))
  const cancelled = appointments.filter((item) => CANCELADOS.has(item.status))
  const counters = countDay(appointments)

  const columns = buildColumns(ctx, live, gerir ? null : acesso.staffId)
  const openRanges = ctx.openRangesByDate.get(date) ?? []
  const { from, to } = drawWindow(openRanges, live, date, unit.timezone)

  const baseHref = `/agenda/${unit.slug}?d=${date}`
  const selected = sel ? (appointments.find((item) => item.id === sel) ?? null) : null
  /*
    A conversa de WhatsApp montada aqui, e não dentro do painel: a mensagem sai
    na língua da cliente e a data dela pede o fuso da loja — duas coisas que o
    servidor tem à mão e que o browser teria de ir buscar. O painel recebe texto
    pronto e uma ligação.
  */
  const confirmacao = selected
    ? {
        link: dadosDeConfirmacao(selected, unit).link,
        enviadaEm: selected.confirmacaoEnviadaEm
          ? `${formatDateShort(isoDateInZone(selected.confirmacaoEnviadaEm, unit.timezone))} às ${formatTime(selected.confirmacaoEnviadaEm, unit.timezone)}`
          : null,
      }
    : undefined

  /*
    A grade de colunas começa a existir na segunda coluna.

    Com uma só ela não é grade: é uma tira de vinte e um rem no meio de mil e
    quatrocentos, e o que ela desenha — o vão entre um atendimento e o outro —
    a lista escreve por extenso, com a duração. É o caso da profissional, que
    além disso nunca encaixa ninguém: escolher cadeira é da gerência. Abaixo de
    `md` a lista é o quadro de toda a gente, porque cinco colunas de onze rem
    não cabem num telemóvel — cabe rolagem lateral, que ninguém faz de pé.
  */
  const grade = columns.length > 1
  /* De quem é o dia que a lista narra — é quem tem vão para medir e nome para
     calar. A gerência com equipa escalada não tem foco: mostra quem atende. */
  const foco = gerir ? (columns.length === 1 ? (columns[0]?.staff.id ?? null) : null) : acesso.staffId

  /*
    Para onde a tela rola sozinha ao abrir. "Agora" só é honesto quando a data
    aberta é hoje — na grade, ainda por cima, quando a hora corrente cai dentro
    da janela desenhada. Fora disso mira no começo do dia.

    São dois alvos porque são dois quadros no mesmo HTML, e é o CSS que decide
    qual aparece; o componente rola até o que estiver mesmo pintado. Na grade o
    alvo é o item e não o atendimento — uma cliente com escova numa cadeira e
    coloração noutra gera dois blocos, e o alvo precisa existir num só lugar.
    Na lista é o contrário: um atendimento, uma linha.
  */
  const now = new Date()
  const ehHoje = date === today
  const agoraNaGrade = now.getTime() >= from.getTime() && now.getTime() < to.getTime()
  const primeiroItem = live
    .flatMap((appointment) => appointment.items.map((item) => ({ id: item.id, start: item.start })))
    .reduce<{ id: string; start: Date } | null>(
      (min, item) => (min === null || item.start < min.start ? item : min),
      null,
    )
  const primeiroAtendimento = live.reduce<AppointmentView | null>(
    (min, item) => (min === null || item.start < min.start ? item : min),
    null,
  )
  const alvoLista =
    primeiroAtendimento === null
      ? null
      : ehHoje
        ? LISTA_NOW_MARKER_ID
        : `${LISTA_ANCHOR_PREFIX}${primeiroAtendimento.id}`
  const alvoGrade = !grade
    ? null
    : agoraNaGrade
      ? NOW_MARKER_ID
      : primeiroItem
        ? `${APPOINTMENT_ANCHOR_PREFIX}${primeiroItem.id}`
        : null
  const alvos = [alvoLista, alvoGrade].filter((alvo): alvo is string => alvo !== null)

  /*
    A medida do quadro, num token que o cabeçalho e a prancheta herdam.
    Sem grade o teto é a medida de leitura de uma lista — a 90rem o nome da
    cliente e a hora ficariam nas duas pontas do monitor. Com grade é a conta
    das colunas, e só a partir de `md`: abaixo disso quem manda é a lista, que
    ocupa a largura toda do telemóvel.
  */
  const larguraQuadro = grade ? `${boardMaxWidthRem(columns.length)}rem` : '44rem'
  const tetoQuadro = grade ? 'md:max-w-(--largura-quadro)' : 'max-w-(--largura-quadro)'

  return (
    <main
      className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8"
      style={{ '--largura-quadro': larguraQuadro } as React.CSSProperties}
    >
      {/* Dia que já passou não muda mais — ali o tique seria só gasto. */}
      <AtualizaSozinho ativo={date >= today} />
      {/* `key={date}`: reaparece a cada dia aberto, mas ignora as
          atualizações automáticas da própria tela — ver o componente. */}
      <RolarParaAgora key={date} alvos={alvos} />

      {/*
        O cabeçalho tem a medida do quadro, não a da tela.
        Ele era `justify-between` dentro de 1400px enquanto a prancheta de duas
        profissionais mede 632: título num canto, botões no outro, e setecentos
        pixels de nada no meio ligando as duas coisas. O teto sai de
        `--largura-quadro`, a mesma conta que `DayGrid` usa para as próprias
        colunas — um lugar só decide a medida, e por isso o "Encaixar" cai
        sempre sobre a borda direita da última coluna de verdade.
      */}
      <header className={cn('mb-5', tetoQuadro)}>
        <div>
          {/*
            Aqui esteve um "← unidades", e ele mentia.

            Não havia ecrã de unidades para onde voltar: `/agenda` sozinho
            reencaminha para a PRIMEIRA loja da pessoa. Quem estava na Maia,
            no dia 27, carregava numa seta de voltar e aterrava em Valongo,
            hoje — outra loja e outro dia, sem ter pedido nenhum dos dois. É
            esse o "voltar que buga a agenda". Trocar de loja é o seletor da
            barra de cima, que troca sem sair do dia.
          */}
          <h1 className="display text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">
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
          O navegador de dia é o mesmo componente da agenda das lojas todas:
          duas telas que fazem a mesma pergunta têm de a fazer com o mesmo
          gesto, senão quem trabalha nelas aprende dois calendários.

          O que muda é o comando da direita. Encaixar é escolher em qual
          cadeira a cliente senta, e para isso é preciso enxergar todas — fica
          com quem enxerga, e não existe na vista das lojas todas, onde não há
          cadeira nenhuma desenhada.
        */}
        <NavegadorDeDia
          base={`/agenda/${unit.slug}`}
          date={date}
          today={today}
          className="mt-4"
          acao={
            gerir ? (
              <Link
                href={href(`/agenda/${unit.slug}/encaixe?d=${date}`)}
                className={cn(buttonVariants(), 'shrink-0')}
              >
                Encaixar
              </Link>
            ) : null
          }
        />
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
        {/*
          Abrir a ficha no telemóvel tem de ser abrir a ficha — e não empurrá-la
          para setecentos pixels abaixo do fundo do quadro, onde nada parece ter
          acontecido. Até `lg` o quadro sai da frente e a ficha fica com o ecrã;
          o "fechar" dela é o caminho de volta. A partir de `lg` os dois cabem
          lado a lado e nada precisa de sair.
        */}
        <div className={cn('min-w-0', tetoQuadro, selected && 'max-lg:hidden')}>
          {columns.length === 0 ? (
            <p className="surface rounded-card text-muted p-6 text-sm">
              {gerir ? 'Ninguém escalado neste dia.' : 'Não está escalada neste dia.'}
            </p>
          ) : (
            <>
              <DayList
                timezone={unit.timezone}
                appointments={live}
                baseHref={baseHref}
                foco={foco}
                agora={ehHoje ? now : null}
                comValor={gerir}
                className={cn(grade && 'md:hidden')}
                {...(sel ? { selectedId: sel } : {})}
              />
              {grade ? (
                <DayGrid
                  timezone={unit.timezone}
                  from={from}
                  to={to}
                  openRanges={openRanges}
                  columns={columns}
                  appointments={live}
                  baseHref={baseHref}
                  className="hidden md:block"
                  {...(sel ? { selectedId: sel } : {})}
                />
              ) : null}
            </>
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
                      className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-(--surface-sunken)"
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
            confirmacao={confirmacao}
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

