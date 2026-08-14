import type { TimeRange } from '@studio/core'
import type { Route } from 'next'
import Link from 'next/link'
import { STATUS_LABEL } from '@/components/agenda/appointment-panel'
import type { StaffInfo } from '@/server/scheduling/context'
import type { AppointmentView } from '@/server/scheduling/queries'
import { formatTime } from '@/lib/format'
import { cn, href as toRoute } from '@/lib/utils'

/**
 * A grade do dia da recepção.
 *
 * Uma coluna por profissional, o tempo correndo para baixo. O detalhe que
 * justifica desenhar isso em vez de listar: o intervalo de processamento
 * aparece vazado dentro do atendimento — é ali que a recepção enxerga que a
 * profissional está livre mesmo com a cliente na cadeira, e é ali que ela
 * encaixa. Uma lista esconde exatamente a informação que faz vender.
 */

/*
  Escala vertical da grade. A 1.7 px/min um expediente de onze horas passava de
  1100px: a recepção via a manhã e rolava para descobrir a tarde, que é
  exatamente o que uma grade existe para evitar. A 1.25 o dia inteiro cabe numa
  tela de tablet, e meia hora ainda tem 37px — altura de sobra para a linha do
  horário e do nome.
*/
const PX_PER_MIN = 1.25
/** Abaixo disso só cabe uma linha, e o serviço sai. */
const COMPACT_PX = 42
const MIN_MS = 60_000

/*
  Medida da prancheta — régua fixa mais um teto por coluna de profissional.
  `agenda/[unidade]/page.tsx` usa exatamente estas constantes (via
  `boardMaxWidthRem`) para o cabeçalho nunca ficar mais largo que a grade: eram
  dois cálculos que só coincidiam por acaso, e um contava as colunas errado
  para o dia de uma profissional só. Um lugar decide a medida agora.
*/
const RAIL_REM = 3.5
const MAX_COL_REM = 18
const MIN_COL_REM = 11

/** Largura máxima da prancheta para `n` colunas — o que o cabeçalho respeita. */
export function boardMaxWidthRem(columns: number): number {
  return RAIL_REM + MAX_COL_REM * columns
}

/** Identificador estável da linha do "agora" — alvo da rolagem automática ao abrir. */
export const NOW_MARKER_ID = 'agenda-agora'
/** Prefixo do identificador de cada atendimento — mesmo alvo usado quando não há "agora" no dia. */
export const APPOINTMENT_ANCHOR_PREFIX = 'apt-'

export interface GridColumn {
  staff: StaffInfo
  /** Escala do dia já cruzada com o horário da unidade. */
  working: readonly TimeRange[]
}

interface DayGridProps {
  timezone: string
  /** Janela desenhada, já arredondada para hora cheia. */
  from: Date
  to: Date
  openRanges: readonly TimeRange[]
  columns: readonly GridColumn[]
  /** Só os que ainda ocupam horário — cancelado não desenha. */
  appointments: readonly AppointmentView[]
  /** Base para o link de seleção, ex. `/agenda/centro?d=2026-08-04`. */
  baseHref: string
  selectedId?: string
}

/**
 * O estado do atendimento é peso de tinta, não uma cor por estado.
 *
 * Cinco pastéis diferentes é o desenho de calendário genérico: obriga a
 * recepção a decorar uma legenda para ler a própria manhã. Aqui o bloco ganha
 * peso conforme a cliente avança — marcado é claro e leve, chegou ganha o banho
 * de bronze, e o que está acontecendo agora é o único bloco maciço da tela.
 * Quem passa pelo tablet acha "quem está na cadeira" sem ler nada. Concluído
 * afunda para o tom da régua e sai do caminho.
 */
const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-(--surface-raised) border-(--border-subtle) text-(--text-body)',
  confirmed: 'bg-(--surface-raised) border-(--border-strong) text-(--text-strong)',
  checked_in: 'bg-(--accent-wash) border-(--accent) text-(--text-strong)',
  /*
    "Agora" é a superfície inversa, não a tinta da marca.
    Com tinta, o bloco funcionava no claro e desaparecia no escuro: lá a tinta
    fica um degrau ABAIXO do fundo, então o atendimento em curso ficava mais
    escuro que os marcados em vez de mais forte — a distinção invertia
    exatamente na tela em que a recepção precisa dela. `--surface-invert` é o
    papel que existe para contrastar com o fundo nos dois esquemas: tinta no
    claro, pedra clara no escuro. É a mesma superfície do botão principal, o que
    diz a coisa certa: dos blocos do dia, este é o que grita.

    Sobre ela, `.text-muted` e o anel de foco globais seriam invisíveis; os dois
    tokens são redefinidos aqui para o filho herdar sem saber onde está.
  */
  in_progress:
    'bg-(--surface-invert) border-(--surface-invert) text-(--on-invert) [--text-muted:var(--on-invert-muted)] [--focus:var(--on-invert)]',
  completed: 'bg-(--surface-sunken) border-(--border-subtle) text-(--text-muted)',
}

/*
  Cinco estados por peso de tinta funcionam para quem já sabe o código; quem
  está aprendendo (ou substituindo por telefone às pressas) precisa de uma
  chave. A legenda usa as mesmas classes de `STATUS_STYLE` — não reinventa a
  cor, só mostra a amostra fora do bloco.
*/
const STATUS_LEGEND = ['scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed'] as const

export function DayGrid({
  timezone,
  from,
  to,
  openRanges,
  columns,
  appointments,
  baseHref,
  selectedId,
}: DayGridProps) {
  const totalMin = (to.getTime() - from.getTime()) / MIN_MS
  const height = totalMin * PX_PER_MIN
  const hours = hourMarks(from, to)

  const offset = (instant: Date) => ((instant.getTime() - from.getTime()) / MIN_MS) * PX_PER_MIN

  /*
    A linha do agora. Só aparece quando o dia desenhado é o dia que está
    correndo — em qualquer outra data ela seria mentira. Vale a pena mesmo
    sendo a hora do desenho e não um relógio: a pergunta que a recepção faz o
    tempo todo é "o que é agora e o que é logo", e sem essa marca ela conta
    linha da régua com o dedo. Envelhece junto com o resto da página.
  */
  const now = new Date()
  const nowOffset =
    now.getTime() >= from.getTime() && now.getTime() < to.getTime() ? offset(now) : null
  const span = (start: Date, end: Date) => ((end.getTime() - start.getTime()) / MIN_MS) * PX_PER_MIN

  const byStaff = new Map<string, { appointment: AppointmentView; item: AppointmentView['items'][number] }[]>()
  for (const appointment of appointments) {
    for (const item of appointment.items) {
      const list = byStaff.get(item.staffId) ?? []
      list.push({ appointment, item })
      byStaff.set(item.staffId, list)
    }
  }

  return (
    /*
      A prancheta tem a largura das colunas, não a da tela. Com `1fr` e duas
      profissionais escaladas, cada coluna esticava para 900px e um corte de
      cabelo virava uma faixa de meia tela — a leitura de "quem está ocupado
      quando" some quando a coluna é mais larga que alta. Coluna tem teto; o
      quadro encolhe para caber nele e rola quando a equipe é grande.
    */
    <div className="surface rounded-card w-fit max-w-full overflow-hidden">
      {/*
        Legenda fora da área que rola: se ela entrasse no `overflow-x-auto` de
        baixo, sumiria assim que a equipe fosse grande o bastante para rolar —
        exatamente quando mais se precisa dela.
      */}
      <ul className="border-(--border-subtle) flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b px-3 py-2 text-xs">
        {STATUS_LEGEND.map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden className={cn('h-3 w-4 shrink-0 rounded-sm border', STATUS_STYLE[status])} />
            <span className="text-muted">{STATUS_LABEL[status]}</span>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `${RAIL_REM}rem repeat(${columns.length}, minmax(${MIN_COL_REM}rem, ${MAX_COL_REM}rem))`,
          }}
        >
          {/* cabeçalho */}
          <div className="sticky top-0 z-20 border-b border-(--border-subtle) bg-(--surface-raised)" />
          {columns.map((column) => (
            <div
              key={column.staff.id}
              className="sticky top-0 z-20 border-b border-l border-(--border-subtle) bg-(--surface-raised) px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: column.staff.color }}
                />
                <span className="truncate">{column.staff.name}</span>
              </span>
              <span className="text-muted text-xs">
                {column.working.length === 0
                  ? 'folga'
                  : column.working
                      .map((range) => `${formatTime(range.start, timezone)}–${formatTime(range.end, timezone)}`)
                      .join(' · ')}
              </span>
            </div>
          ))}

          {/*
            Régua de horas. A primeira e a última marca não podem ser centradas
            na linha: a grade rola, então metade do "09:00" ficava cortada no topo
            e o fechamento sumiria embaixo. Extremos encostam por dentro, o miolo
            fica centrado — é como uma régua impressa se comporta.
          */}
          <div className="relative" style={{ height }}>
            {hours.map((hour, i) => (
              <span
                key={hour.getTime()}
                className={cn(
                  'tnum text-muted absolute right-2 text-xs',
                  i === 0 ? '' : i === hours.length - 1 ? '-translate-y-full' : '-translate-y-1/2',
                )}
                style={{ top: offset(hour) }}
              >
                {formatTime(hour, timezone)}
              </span>
            ))}
            {nowOffset === null ? null : (
              <span
                id={NOW_MARKER_ID}
                aria-hidden
                className="absolute right-0 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-(--accent)"
                style={{ top: nowOffset }}
              />
            )}
          </div>

          {/* colunas */}
          {columns.map((column) => (
            <div
              key={column.staff.id}
              className="relative border-l border-(--border-subtle) bg-(--surface-sunken)"
              style={{ height }}
            >
              {/* escala do dia: o que está fora fica afundado */}
              {column.working.map((range) => (
                <div
                  key={range.start.getTime()}
                  className="absolute inset-x-0 bg-(--surface-raised)"
                  style={{ top: offset(range.start), height: span(range.start, range.end) }}
                />
              ))}

              {hours.map((hour) => (
                <div
                  key={hour.getTime()}
                  className="absolute inset-x-0 border-t border-(--border-subtle)"
                  style={{ top: offset(hour) }}
                />
              ))}

              {nowOffset === null ? null : (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-10 border-t border-(--accent)"
                  style={{ top: nowOffset }}
                />
              )}

              {(byStaff.get(column.staff.id) ?? []).map(({ appointment, item }) => (
                <ItemBlock
                  key={item.id}
                  appointment={appointment}
                  item={item}
                  timezone={timezone}
                  top={offset(item.start)}
                  height={span(item.start, item.end)}
                  href={toRoute(`${baseHref}${baseHref.includes('?') ? '&' : '?'}sel=${appointment.id}`)}
                  selected={appointment.id === selectedId}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {openRanges.length === 0 ? (
        <p className="text-muted border-t border-(--border-subtle) px-4 py-3 text-sm">
          A unidade não abre neste dia.
        </p>
      ) : null}
    </div>
  )
}

function ItemBlock({
  appointment,
  item,
  timezone,
  top,
  height,
  href,
  selected,
}: {
  appointment: AppointmentView
  item: AppointmentView['items'][number]
  timezone: string
  top: number
  height: number
  href: Route
  selected: boolean
}) {
  const compact = height < COMPACT_PX

  return (
    <Link
      /*
        Ancorado no item, não no atendimento: uma cliente com escova numa
        cadeira e coloração noutra gera dois blocos para o mesmo `appointment.id`
        — se o alvo fosse esse id, os dois cartões disputariam o mesmo `id` de
        HTML e a rolagem pousaria num dos dois por sorte.
      */
      id={`${APPOINTMENT_ANCHOR_PREFIX}${item.id}`}
      href={href}
      scroll={false}
      className={cn(
        'rounded-plate absolute inset-x-1 overflow-hidden border px-2 py-1 text-xs',
        'transition-shadow duration-200 ease-(--ease-out-quint) hover:shadow-(--shadow-raise)',
        STATUS_STYLE[appointment.status] ?? STATUS_STYLE.scheduled,
        /*
          Sem faixa colorida na borda esquerda: a cor da profissional já é a
          coluna onde o bloco está: repeti-la em cada cartão é enfeite que não
          informa nada. O que a borda precisa marcar é a seleção, e para isso
          basta o bronze da marca.
        */
        selected && 'ring-2 ring-(--accent) ring-offset-0',
      )}
      style={{ top, height: Math.max(height - 2, 22) }}
    >
      <span className="relative block truncate font-medium">
        <span className="tnum">{formatTime(item.start, timezone)}</span> {firstName(appointment.clientName)}
      </span>
      {compact ? null : (
        <span className="text-muted relative block truncate">{item.serviceName}</span>
      )}
      {/*
        O estado é peso de tinta na tela; para quem usa leitor ele precisa ser
        palavra. Mesmo vocabulário do painel, para não existirem dois nomes
        para o mesmo estado dentro do sistema.
      */}
      <span className="sr-only">
        {' · '}
        {STATUS_LABEL[appointment.status] ?? appointment.status}
      </span>
    </Link>
  )
}

/** Marcas de hora cheia dentro da janela. */
function hourMarks(from: Date, to: Date): Date[] {
  const marks: Date[] = []
  for (let t = from.getTime(); t <= to.getTime(); t += 60 * MIN_MS) marks.push(new Date(t))
  return marks
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name
}
