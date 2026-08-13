import Link from 'next/link'
import { Vazio } from '@/components/shell/painel-shell'
import { formatDateLong, formatMoney, formatWeekdayShort } from '@/lib/format'
import { grelhaDoMes, mesmoMes } from '@/lib/periodo'
import { cn, href } from '@/lib/utils'
import type { Compromisso } from '@/server/scheduling/minha-agenda'

/**
 * As três escalas da agenda de uma pessoa.
 *
 * A mesma informação, em três distâncias, e cada uma responde a uma pergunta
 * diferente:
 *
 * - **Dia** — "o que faço a seguir?". Linha do tempo, hora à esquerda, nome da
 *   cliente grande. É o ecrã que fica aberto no telemóvel entre atendimentos.
 * - **Semana** — "quando é que tenho um buraco?". Sete colunas curtas: o que
 *   se lê é a FORMA da semana, não o detalhe de cada visita.
 * - **Mês** — "como está a correr o mês?". Grade de calendário com o peso de
 *   cada dia. Ninguém lê nomes aqui; lê-se carga.
 *
 * O estado da visita é peso de tinta e não uma cor por estado — cinco pastéis
 * obrigariam a decorar uma legenda para ler a própria manhã. É a mesma regra da
 * grade da recepção.
 */

const ESTADO: Record<string, string> = {
  draft: 'por confirmar',
  scheduled: 'marcado',
  confirmed: 'confirmado',
  checked_in: 'chegou',
  in_progress: 'a decorrer',
  completed: 'feito',
  cancelled_by_client: 'cancelado',
  cancelled_by_studio: 'cancelado',
  no_show: 'faltou',
}

/** Onde se abre a ficha da visita, a partir de qualquer das três escalas. */
function fichaDe(item: Compromisso) {
  return href(`/painel/atendimento/${item.appointmentId}`)
}

// ─── dia ────────────────────────────────────────────────────────────────────

export function AgendaDoDia({
  compromissos,
  varias,
}: {
  compromissos: readonly Compromisso[]
  /** A pessoa atende em mais de uma casa: a loja passa a ser informação. */
  varias: boolean
}) {
  if (compromissos.length === 0) {
    return (
      <Vazio titulo="Nada marcado neste dia">
        Quando alguém marcar consigo, a visita aparece aqui — com o serviço, a hora e a casa.
      </Vazio>
    )
  }

  return (
    <ol className="border-t border-(--border-strong)">
      {compromissos.map((item) => (
        <li key={item.appointmentId}>
          <Link
            href={fichaDe(item)}
            className="group flex items-start gap-4 border-b border-(--border-subtle) px-2 py-4 transition-colors hover:bg-(--surface-sunken) sm:gap-6"
          >
            {/* A hora é a âncora: coluna fixa, tabular, para as linhas
                formarem uma régua que se lê de cima a baixo. */}
            <span className="tnum w-14 shrink-0 pt-0.5 sm:w-16">
              <span className="block text-[0.9375rem] font-medium">{item.hora}</span>
              <span className="text-muted block text-[0.75rem]">{item.horaFim}</span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block font-medium">{item.clienteNome}</span>
              <span className="text-body block text-sm">{item.servicos.join(' · ')}</span>
              <span className="text-muted mt-0.5 block text-[0.75rem]">
                {ESTADO[item.status] ?? item.status}
                {varias ? ` · ${item.unidadeNome}` : ''}
              </span>
            </span>

            <span className="tnum shrink-0 pt-0.5 text-right text-[0.9375rem]">
              {formatMoney(item.valor)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

// ─── semana ─────────────────────────────────────────────────────────────────

export function AgendaDaSemana({
  dias,
  compromissos,
  hoje,
  base,
}: {
  dias: readonly string[]
  compromissos: readonly Compromisso[]
  hoje: string
  base: string
}) {
  const porDia = agrupar(compromissos)

  return (
    /*
      Sete colunas no ecrã largo, sete blocos empilhados no telemóvel. Não é a
      mesma grade a encolher: uma coluna de 50px de largura não mostra nome de
      cliente nenhum, e a semana no telemóvel serve para percorrer, não para
      comparar lado a lado.
    */
    <div className="grid gap-px overflow-hidden rounded-plate border border-(--border-subtle) bg-(--border-subtle) lg:grid-cols-7">
      {dias.map((dia) => {
        const doDia = porDia.get(dia) ?? []
        const eHoje = dia === hoje
        return (
          <div key={dia} className="min-w-0 bg-(--surface-raised)">
            <div
              className={cn(
                'flex items-baseline justify-between gap-2 px-3 py-2',
                eHoje ? 'bg-(--surface-invert) text-(--on-invert)' : 'bg-(--surface-sunken)',
              )}
            >
              <span className="text-[0.6875rem] tracking-[0.08em] uppercase">
                {formatWeekdayShort(dia)}
              </span>
              <span className="tnum text-sm font-medium">{Number(dia.slice(8, 10))}</span>
            </div>

            <ul className="min-h-24 divide-y divide-(--border-subtle)">
              {doDia.map((item) => (
                <li key={item.appointmentId}>
                  <Link
                    href={fichaDe(item)}
                    className="block px-3 py-2.5 transition-colors hover:bg-(--surface-sunken)"
                  >
                    <span className="tnum block text-[0.8125rem] font-medium">{item.hora}</span>
                    <span className="block truncate text-[0.8125rem]">{item.clienteNome}</span>
                    <span className="text-muted block truncate text-[0.75rem]">
                      {item.servicos.join(', ')}
                    </span>
                  </Link>
                </li>
              ))}
              {doDia.length === 0 ? (
                <li className="text-muted px-3 py-4 text-[0.75rem]">—</li>
              ) : null}
            </ul>

            {doDia.length > 0 ? (
              <Link
                href={href(`${base}?v=dia&d=${dia}`)}
                className="text-muted block border-t border-(--border-subtle) px-3 py-2 text-[0.75rem] transition-colors hover:bg-(--surface-sunken) hover:text-(--text-strong)"
              >
                ver o dia
              </Link>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ─── mês ────────────────────────────────────────────────────────────────────

const CABECALHO = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const

export function AgendaDoMes({
  data,
  compromissos,
  hoje,
  base,
}: {
  data: string
  compromissos: readonly Compromisso[]
  hoje: string
  base: string
}) {
  const porDia = agrupar(compromissos)
  const semanas = grelhaDoMes(data)

  return (
    <div>
      <div className="grid grid-cols-7 gap-px pb-1">
        {CABECALHO.map((nome) => (
          <div
            key={nome}
            className="text-muted px-2 text-center text-[0.6875rem] tracking-[0.1em] uppercase"
          >
            {nome}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-plate border border-(--border-subtle) bg-(--border-subtle)">
        {semanas.flat().map((dia) => {
          const doDia = porDia.get(dia) ?? []
          const doMes = mesmoMes(dia, data)
          const eHoje = dia === hoje
          const valor = doDia.reduce((soma, item) => soma + item.valor, 0)

          return (
            <Link
              key={dia}
              href={href(`${base}?v=dia&d=${dia}`)}
              className={cn(
                'flex min-h-20 flex-col gap-1 p-1.5 transition-colors sm:min-h-24 sm:p-2',
                doMes ? 'bg-(--surface-raised)' : 'bg-(--surface)',
                'hover:bg-(--surface-sunken)',
              )}
            >
              <span
                className={cn(
                  'tnum grid size-6 shrink-0 place-items-center rounded-full text-[0.8125rem]',
                  eHoje && 'bg-(--surface-invert) font-medium text-(--on-invert)',
                  !eHoje && !doMes && 'text-(--text-muted) opacity-60',
                )}
              >
                {Number(dia.slice(8, 10))}
              </span>

              {doDia.length > 0 ? (
                <span className="min-w-0">
                  {/*
                    Peso, não lista. O mês serve para ver como o mês está — e
                    quatro nomes de cliente truncados a meio numa célula de
                    90px não dizem nada a ninguém. O número de visitas e o
                    valor dizem.
                  */}
                  <span className="tnum block text-[0.8125rem] font-medium">
                    {doDia.length} {doDia.length === 1 ? 'visita' : 'visitas'}
                  </span>
                  <span className="tnum text-muted block text-[0.75rem]">
                    {formatMoney(valor)}
                  </span>
                </span>
              ) : null}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── resumo ─────────────────────────────────────────────────────────────────

/**
 * O período em uma frase.
 *
 * Não é um mostrador de quatro números grandes — esse é o template de métrica
 * que toda ferramenta desenha. Aqui o resumo mora na linha de baixo do
 * navegador, do tamanho do texto, e quem manda no espaço é a agenda.
 */
export function ResumoDoPeriodo({
  visitas,
  valor,
  minutos,
}: {
  visitas: number
  valor: number
  minutos: number
}) {
  if (visitas === 0) return null
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60

  return (
    <p className="text-body text-sm">
      <strong className="tnum font-medium text-(--text-strong)">{visitas}</strong>{' '}
      {visitas === 1 ? 'visita' : 'visitas'}
      <span className="text-muted"> · </span>
      <strong className="tnum font-medium text-(--text-strong)">
        {horas > 0 ? `${horas}h` : ''}
        {resto > 0 ? `${String(resto).padStart(horas > 0 ? 2 : 1, '0')}min` : horas > 0 ? '' : '0min'}
      </strong>{' '}
      de cadeira
      <span className="text-muted"> · </span>
      <strong className="tnum font-medium text-(--text-strong)">{formatMoney(valor)}</strong>
    </p>
  )
}

/** O rótulo do período, escrito como uma pessoa o diria. */
export function rotuloDoPeriodo(vista: 'dia' | 'semana' | 'mes', data: string, de: string, ate: string): string {
  if (vista === 'dia') return formatDateLong(data)
  if (vista === 'mes') {
    return new Date(`${data}T12:00:00Z`).toLocaleDateString('pt-PT', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  /* "4 – 10 de agosto" quando o mês é o mesmo; "28 de julho – 3 de agosto"
     quando a semana atravessa. Repetir o mês nos dois lados quando ele não
     muda é ruído. */
  const inicio = new Date(`${de}T12:00:00Z`)
  const fim = new Date(`${ate}T12:00:00Z`)
  const mesmoMesCivil = de.slice(0, 7) === ate.slice(0, 7)
  const dia = (d: Date) => d.getUTCDate()
  const mes = (d: Date) =>
    d.toLocaleDateString('pt-PT', { month: 'long', timeZone: 'UTC' })

  return mesmoMesCivil
    ? `${dia(inicio)} – ${dia(fim)} de ${mes(fim)}`
    : `${dia(inicio)} de ${mes(inicio)} – ${dia(fim)} de ${mes(fim)}`
}

function agrupar(compromissos: readonly Compromisso[]): Map<string, Compromisso[]> {
  const mapa = new Map<string, Compromisso[]>()
  for (const item of compromissos) {
    const lista = mapa.get(item.data) ?? []
    lista.push(item)
    mapa.set(item.data, lista)
  }
  return mapa
}
