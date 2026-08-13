import { addDaysInZone, zonedDateTime, type TimeRange } from '@studio/core'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppointmentPanel, STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { DayGrid, type GridColumn } from '@/components/agenda/day-grid'
import { PainelShell } from '@/components/shell/painel-shell'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { buttonVariants } from '@/components/ui/button'
import { formatDateLong, formatMoney, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { podeGerir } from '@/server/auth/permissoes'
import { contextoDoPainel } from '@/server/painel/contexto'
import { todayInUnit } from '@/server/scheduling/availability'
import { loadBookingContext } from '@/server/scheduling/context'
import { countDay, listDayAppointments, type AppointmentView } from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Hoje' }

const HORA_MS = 3_600_000
const CANCELADOS = new Set(['cancelled_by_client', 'cancelled_by_studio', 'no_show'])

/**
 * Hoje — o dia da casa.
 *
 * ── O que foi juntado aqui ────────────────────────────────────────────────
 * Eram duas telas. `/` mostrava uma pauta com uma linha por loja e os números
 * do dia; `/agenda` pedia para escolher a loja e só então `/agenda/[loja]`
 * desenhava a grade. Quem abria o sistema de manhã atravessava as três para
 * chegar ao que queria ver, e a pauta ficava aberta num canto a repetir
 * números que a grade já mostrava.
 *
 * Agora é uma tela só: a fita das casas em cima (quando há mais de uma), a
 * grade da casa activa em baixo. Trocar de loja é um toque na fita, e o resto
 * do painel — caixa, clientes, avisos — acompanha, porque a casa activa é
 * estado do painel e não do endereço.
 *
 * Quem atende não passa por aqui: o "hoje" dela é a agenda dela, e o caixa da
 * loja não é assunto seu.
 */
export default async function HojePage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; sel?: string }>
}) {
  const { d, sel } = await searchParams
  const { acesso, unidades, unidade } = await contextoDoPainel()

  if (!podeGerir(acesso)) redirect('/painel/agenda')

  if (!unidade) {
    return (
      <PainelShell
        acesso={acesso}
        unidades={unidades}
        unidade={null}
        activa="hoje"
        titulo="Hoje"
        semCasa
      >
        <p className="text-muted">
          Ainda não há nenhuma casa atribuída a esta conta. Fale com a administração.
        </p>
      </PainelShell>
    )
  }

  const hoje = todayInUnit(unidade)
  const data = /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? (d as string) : hoje

  const [ctx, marcacoes] = await Promise.all([
    loadBookingContext({ unit: unidade, fromDate: data, toDate: data }),
    listDayAppointments(unidade, data),
  ])

  const vivas = marcacoes.filter((item) => !CANCELADOS.has(item.status))
  const mortas = marcacoes.filter((item) => CANCELADOS.has(item.status))
  const contas = countDay(marcacoes)

  const colunas = montarColunas(ctx, vivas)
  const janelas = ctx.openRangesByDate.get(data) ?? []
  const { de, ate } = janelaDesenhada(janelas, vivas, data, unidade.timezone)

  const base = `/painel?d=${data}`
  const seleccionada = sel ? (marcacoes.find((item) => item.id === sel) ?? null) : null

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="hoje"
      titulo={data === hoje ? 'Hoje' : 'O dia'}
      descricao={formatDateLong(data)}
      acao={
        <Link href={href(`/painel/encaixe?d=${data}`)} className={buttonVariants({ size: 'sm' })}>
          Encaixar
        </Link>
      }
    >
      {/* Dia que já passou não muda mais — ali o tique seria só gasto. */}
      <AtualizaSozinho ativo={data >= hoje} />

      {/* ── o navegador de dia ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          href={href(`/painel?d=${addDaysInZone(data, -1)}`)}
          aria-label="Dia anterior"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'px-2.5')}
        >
          ←
        </Link>
        <span className="text-sm font-medium first-letter:uppercase">{formatDateLong(data)}</span>
        <Link
          href={href(`/painel?d=${addDaysInZone(data, 1)}`)}
          aria-label="Dia seguinte"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'px-2.5')}
        >
          →
        </Link>
        {data === hoje ? null : (
          <Link
            href={href('/painel')}
            className="text-muted rounded-plate px-1 text-sm transition-colors hover:text-(--text-strong)"
          >
            hoje
          </Link>
        )}

        {/*
          O resumo do dia é uma frase, não cinco placas. Cinco caixas iguais em
          cima da grade empurravam a agenda para baixo da dobra — e a agenda é a
          tela. "Cancelados" só aparece quando existe: um zero permanente não é
          informação, é ruído com a mesma altura de tudo o resto.
        */}
        <p className="text-body ml-auto text-sm">
          <Num>{contas.reserved}</Num> na agenda
          {contas.completed > 0 ? (
            <>
              {' · '}
              <Num>{contas.completed}</Num> {contas.completed === 1 ? 'feito' : 'feitos'}
            </>
          ) : null}
          {contas.cancelled > 0 ? (
            <>
              {' · '}
              <Num>{contas.cancelled}</Num>{' '}
              {contas.cancelled === 1 ? 'cancelado' : 'cancelados'}
            </>
          ) : null}
          {' · '}
          <Num>{formatMoney(contas.revenue)}</Num> no caixa
          {contas.expected > contas.revenue ? (
            <>
              {' de '}
              <span className="tnum">{formatMoney(contas.expected)}</span> previstos
            </>
          ) : null}
        </p>
      </div>

      {/*
        `auto`, não `1fr`, e a grade não estica. Com `1fr` a coluna da grade
        engolia o espaço livre e a ficha da cliente ia parar à outra ponta da
        tela — meio palmo de nada entre o bloco que se clica e o painel que ele
        abre, quando os dois são a mesma acção.
      */}
      <div
        className={cn(
          'mt-6 grid gap-5',
          seleccionada && 'lg:grid-cols-[auto_22rem] lg:justify-start',
        )}
      >
        <div className="min-w-0">
          {colunas.length === 0 ? (
            <p className="rounded-plate text-muted border border-dashed border-(--border-strong) px-5 py-10 text-center text-sm">
              Ninguém escalado neste dia.
            </p>
          ) : (
            <DayGrid
              timezone={unidade.timezone}
              from={de}
              to={ate}
              openRanges={janelas}
              columns={colunas}
              appointments={vivas}
              baseHref={base}
              {...(sel ? { selectedId: sel } : {})}
            />
          )}

          {mortas.length > 0 ? (
            <section className="mt-6">
              <h2 className="text-muted mb-2 text-sm">Cancelados e faltas</h2>
              <ul className="rounded-plate divide-y divide-(--border-subtle) border border-(--border-subtle) bg-(--surface-raised)">
                {mortas.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={href(`${base}&sel=${item.id}`)}
                      scroll={false}
                      className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-(--surface-sunken)"
                    >
                      <span>
                        <span className="tnum text-muted mr-2">
                          {formatTime(item.start, unidade.timezone)}
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

        {seleccionada ? (
          <AppointmentPanel
            appointment={seleccionada}
            timezone={unidade.timezone}
            closeHref={base}
            gerir
          />
        ) : null}
      </div>
    </PainelShell>
  )
}

/** Número dentro da frase do dia: mesmo corpo do texto, só mais tinta. */
function Num({ children }: { children: React.ReactNode }) {
  return <strong className="tnum font-medium text-(--text-strong)">{children}</strong>
}

/** Uma coluna por profissional escalado — mais quem tem atendimento no dia. */
function montarColunas(
  ctx: Awaited<ReturnType<typeof loadBookingContext>>,
  vivas: readonly AppointmentView[],
): GridColumn[] {
  const comTrabalho = new Set(vivas.flatMap((item) => item.items.map((linha) => linha.staffId)))

  return ctx.staff
    .filter((pessoa) => pessoa.workingRanges.length > 0 || comTrabalho.has(pessoa.staffId))
    .map((pessoa) => {
      const staff = ctx.staffInfo.get(pessoa.staffId)
      return staff ? { staff, working: pessoa.workingRanges } : null
    })
    .filter((coluna): coluna is GridColumn => coluna !== null)
    .sort((a, b) => a.staff.name.localeCompare(b.staff.name, 'pt-PT'))
}

/**
 * Janela desenhada: o horário da casa, esticado para caber atendimento que
 * comece antes ou termine depois (encaixe fora do expediente acontece).
 */
function janelaDesenhada(
  janelas: readonly TimeRange[],
  vivas: readonly AppointmentView[],
  data: string,
  timezone: string,
): { de: Date; ate: Date } {
  const inicios = [...janelas.map((r) => r.start), ...vivas.map((a) => a.start)]
  const fins = [...janelas.map((r) => r.end), ...vivas.map((a) => a.end)]

  if (inicios.length === 0) {
    // dia fechado e sem nada marcado: a grade ainda precisa de altura
    const de = zonedDateTime(data, '08:00', timezone)
    return { de, ate: new Date(de.getTime() + 12 * HORA_MS) }
  }

  const de = new Date(Math.floor(Math.min(...inicios.map((d) => d.getTime())) / HORA_MS) * HORA_MS)
  const ate = new Date(Math.ceil(Math.max(...fins.map((d) => d.getTime())) / HORA_MS) * HORA_MS)
  return { de, ate }
}
