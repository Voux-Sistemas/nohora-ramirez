import Link from 'next/link'
import { STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { MarcaDeConfirmacao } from '@/components/agenda/marca-confirmacao'
import { formatMoney, formatTime } from '@/lib/format'
import { cn, href as toRoute } from '@/lib/utils'
import type { AppointmentView } from '@/server/scheduling/queries'

/**
 * O dia como lista — o quadro de quem tem o telemóvel na mão.
 *
 * A grade de colunas existe por um motivo só, e está escrito lá: é nela que a
 * receção enxerga o intervalo de processamento e encaixa alguém. Esse motivo
 * some em dois casos, e nos dois a grade passa a ser o desenho errado.
 *
 * O primeiro é a profissional. Ela tem uma coluna, e uma coluna não é grade: é
 * uma tira de vinte e um rem no meio de uma tela larga, com o dia inteiro
 * empurrado para fora do ecrã do telemóvel. E ela não encaixa ninguém — escolher
 * cadeira é da gerência.
 *
 * O segundo é o telemóvel de qualquer pessoa. Cinco colunas de onze rem não
 * cabem em trezentos e quarenta pixels; o que cabe é rolagem lateral, que é o
 * gesto que ninguém faz de pé com a cliente à frente.
 *
 * O que a lista não pode fazer é esconder o vão — seria trocar o desenho certo
 * por um que mente por omissão. Por isso o intervalo entre um atendimento e o
 * seguinte aparece nomeado, com a duração escrita: "livre · 45 min". A grade
 * mostra o buraco; a lista diz o tamanho dele. Só que o vão só é honesto quando
 * há uma pessoa em foco — o buraco da equipa inteira não é buraco de ninguém —,
 * e é isso que `foco` decide.
 */

const MIN_MS = 60_000
/** Abaixo disto não é vão, é troca de toalha. Nomear seria ruído a cada linha. */
const VAO_MINIMO_MIN = 20

/** Alvos de rolagem próprios — a grade tem os dela, e as duas convivem no DOM. */
export const LISTA_NOW_MARKER_ID = 'agenda-agora-lista'
export const LISTA_ANCHOR_PREFIX = 'lista-apt-'

/**
 * O estado é peso de tinta, como na grade — aqui num fio na borda esquerda.
 *
 * A escala é a mesma e pela mesma razão: marcado é fio fino, chegou ganha o
 * bronze, o que está a acontecer agora é o único traço maciço da lista, e
 * concluído afunda para o tom da régua e sai do caminho.
 */
const ESTADO_BARRA: Record<string, string> = {
  scheduled: 'bg-(--border-subtle)',
  confirmed: 'bg-(--border-strong)',
  checked_in: 'bg-(--accent)',
  in_progress: 'bg-(--surface-invert)',
  completed: 'bg-(--surface-sunken)',
}

interface DayListProps {
  timezone: string
  /** Só os que ainda ocupam horário — cancelado tem lista própria. */
  appointments: readonly AppointmentView[]
  /** Base do link de seleção, ex. `/agenda/centro?d=2026-08-04`. */
  baseHref: string
  selectedId?: string
  /**
   * De quem é o dia narrado. Com uma pessoa em foco a lista mede os vãos dela e
   * cala o nome (é sempre o mesmo); a `null`, mostra quem atende cada linha.
   */
  foco: string | null
  /** Instante corrente, ou `null` quando a data aberta não é hoje. */
  agora: Date | null
  /** O caixa do dia é da loja, não da cadeira — ver o cabeçalho da agenda. */
  comValor: boolean
  className?: string
}

type Linha =
  | { tipo: 'agora' }
  | { tipo: 'vao'; minutos: number }
  | { tipo: 'atendimento'; atendimento: AppointmentView; inicio: Date; fim: Date }

export function DayList({
  timezone,
  appointments,
  baseHref,
  selectedId,
  foco,
  agora,
  comValor,
  className,
}: DayListProps) {
  const linhas = montarLinhas(appointments, foco, agora)
  const separador = baseHref.includes('?') ? '&' : '?'

  /* Uma placa vazia com um fio à volta não diz nada; a frase diz. */
  if (linhas.length === 0) {
    return (
      <p className={cn('surface rounded-card text-muted p-6 text-sm', className)}>
        Nada marcado {agora === null ? 'neste dia' : 'para hoje'}.
      </p>
    )
  }

  return (
    <ol
      className={cn(
        'surface rounded-card divide-y divide-(--border-subtle) overflow-hidden',
        className,
      )}
    >
      {linhas.map((linha, i) => {
        if (linha.tipo === 'agora') {
          return (
            <li
              key="agora"
              id={LISTA_NOW_MARKER_ID}
              className="bg-(--accent-wash) px-3 py-1 text-center"
            >
              <span className="label-caps text-(--accent-ink)">agora</span>
            </li>
          )
        }

        if (linha.tipo === 'vao') {
          return (
            <li
              key={`vao-${i}`}
              className="text-muted bg-(--surface-sunken) px-3 py-1 text-center text-xs"
            >
              livre · {duracao(linha.minutos)}
            </li>
          )
        }

        const { atendimento, inicio, fim } = linha
        const selecionado = atendimento.id === selectedId

        return (
          <li key={atendimento.id} id={`${LISTA_ANCHOR_PREFIX}${atendimento.id}`}>
            <Link
              href={toRoute(`${baseHref}${separador}sel=${atendimento.id}`)}
              scroll={false}
              aria-current={selecionado ? 'true' : undefined}
              className={cn(
                'flex min-h-17 items-stretch gap-3 py-2.5 pr-3 transition-colors',
                selecionado ? 'bg-(--surface-sunken)' : 'hover:bg-(--surface-sunken)',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'w-1 shrink-0 rounded-r-full',
                  ESTADO_BARRA[atendimento.status] ?? ESTADO_BARRA.scheduled,
                )}
              />

              {/* A hora à esquerda, em coluna fixa: é por ela que o polegar
                  varre a lista, e uma régua que dança não se varre. */}
              <span className="tnum flex w-11 shrink-0 flex-col justify-center leading-tight">
                <span className="text-sm font-medium text-(--text-strong)">
                  {formatTime(inicio, timezone)}
                </span>
                <span className="text-muted text-xs">{formatTime(fim, timezone)}</span>
              </span>

              <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                <span className="flex items-baseline gap-2">
                  <MarcaDeConfirmacao appointment={atendimento} />
                  <span className="truncate font-medium">{atendimento.clientName}</span>
                  {/*
                    "marcado" é o estado de quase toda a lista: escrevê-lo em
                    cada linha é a mesma tinta em todo o lado, que não distingue
                    nada. A etiqueta só aparece quando o atendimento saiu do
                    normal — e o fio da esquerda continua a dizer o estado a
                    quem varre sem ler.
                  */}
                  {atendimento.status === 'scheduled' ? null : (
                    <span className="text-muted shrink-0 text-xs whitespace-nowrap">
                      {STATUS_LABEL[atendimento.status] ?? atendimento.status}
                    </span>
                  )}
                </span>

                <span className="text-muted block truncate text-sm">
                  {servicosDe(atendimento, foco)}
                </span>

                {/* Quem atende só é notícia quando pode ser outra pessoa. */}
                {foco === null ? (
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {equipaDe(atendimento).map((pessoa) => (
                      <span key={pessoa.id} className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: pessoa.color }}
                        />
                        <span className="text-muted truncate">{primeiroNome(pessoa.name)}</span>
                      </span>
                    ))}
                  </span>
                ) : null}
              </span>

              {comValor ? (
                <span className="tnum text-muted shrink-0 self-center text-xs">
                  {formatMoney(atendimento.totalPrice)}
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * A lista em ordem, com o "agora" e os vãos intercalados.
 *
 * O "agora" entra antes do primeiro atendimento que ainda não começou — e cai
 * no fim quando o dia já passou todo, que é onde ele de facto está.
 */
function montarLinhas(
  appointments: readonly AppointmentView[],
  foco: string | null,
  agora: Date | null,
): Linha[] {
  const ordenados = appointments
    .map((atendimento) => ({ atendimento, ...janelaDe(atendimento, foco) }))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())

  const linhas: Linha[] = []
  let agoraPosto = agora === null
  /* Em milissegundos, e `0` é "ainda não houve nada" — a agenda de um salão
     não passa por 1970, então o valor não colide com nenhum fim de verdade. */
  let fimAnterior = 0

  for (const { atendimento, inicio, fim } of ordenados) {
    if (!agoraPosto && inicio.getTime() > agora!.getTime()) {
      linhas.push({ tipo: 'agora' })
      agoraPosto = true
    }

    /* Vão só com alguém em foco: o buraco da equipa inteira não é de ninguém. */
    if (foco !== null && fimAnterior > 0) {
      const minutos = Math.round((inicio.getTime() - fimAnterior) / MIN_MS)
      if (minutos >= VAO_MINIMO_MIN) linhas.push({ tipo: 'vao', minutos })
    }

    linhas.push({ tipo: 'atendimento', atendimento, inicio, fim })
    /* Sobreposição existe (dois serviços em cadeiras diferentes): o vão conta
       do ponto mais tarde já ocupado, senão apareceria um "livre" negativo. */
    fimAnterior = Math.max(fimAnterior, fim.getTime())
  }

  if (!agoraPosto && linhas.length > 0) linhas.push({ tipo: 'agora' })
  return linhas
}

/**
 * O pedaço do atendimento que interessa a esta lista.
 *
 * Com foco, é o troço da pessoa: a cliente que faz escova com uma e coloração
 * com outra ocupa cada uma delas em horas diferentes, e a linha tem de dizer a
 * hora de quem está a ler. Sem foco, é o atendimento inteiro.
 */
function janelaDe(
  atendimento: AppointmentView,
  foco: string | null,
): { inicio: Date; fim: Date } {
  const meus = foco === null ? [] : atendimento.items.filter((item) => item.staffId === foco)
  if (meus.length === 0) return { inicio: atendimento.start, fim: atendimento.end }

  return {
    inicio: new Date(Math.min(...meus.map((item) => item.start.getTime()))),
    fim: new Date(Math.max(...meus.map((item) => item.end.getTime()))),
  }
}

/** Os serviços da linha: os da pessoa em foco, ou todos quando não há foco. */
function servicosDe(atendimento: AppointmentView, foco: string | null): string {
  const meus =
    foco === null ? atendimento.items : atendimento.items.filter((item) => item.staffId === foco)
  const lista = meus.length > 0 ? meus : atendimento.items
  return lista.map((item) => item.serviceName).join(' · ')
}

/** Quem põe a mão neste atendimento, sem repetir quem faz dois serviços. */
function equipaDe(atendimento: AppointmentView) {
  const porPessoa = new Map<string, { id: string; name: string; color: string }>()
  for (const item of atendimento.items) {
    if (!porPessoa.has(item.staffId)) {
      porPessoa.set(item.staffId, { id: item.staffId, name: item.staffName, color: item.staffColor })
    }
  }
  return [...porPessoa.values()]
}

/** "45 min", "1 h 15", "2 h" — como se diz em voz alta, não em minutos crus. */
function duracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto === 0 ? `${horas} h` : `${horas} h ${String(resto).padStart(2, '0')}`
}

function primeiroNome(name: string): string {
  return name.split(' ')[0] ?? name
}
