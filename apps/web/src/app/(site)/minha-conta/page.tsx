import Link from 'next/link'
import { BotaoCancelar } from '@/components/conta/cancelar'
import { buttonVariants } from '@/components/ui/button'
import { formatDateLong, formatMoney, formatPhone, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { sair } from '@/server/auth/actions'
import { requireClientSession } from '@/server/auth/session'
import { listClientAppointments, type AppointmentView } from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'A minha conta' }

/** Estados em que a visita ainda vai acontecer. */
const EM_ABERTO = new Set(['draft', 'scheduled', 'confirmed', 'checked_in', 'in_progress'])

/** Como a cliente lê o estado. Não é o vocabulário da recepção. */
const ESTADO: Record<string, string> = {
  draft: 'por confirmar',
  scheduled: 'marcado',
  confirmed: 'confirmado',
  checked_in: 'já chegou',
  in_progress: 'a decorrer',
  completed: 'feito',
  cancelled_by_client: 'cancelado por si',
  cancelled_by_studio: 'cancelado pelo salão',
  no_show: 'faltou',
}

/**
 * A conta da cliente.
 *
 * ── O que mudou ───────────────────────────────────────────────────────────
 * Era uma tela sem casca, com duas placas cinzentas empilhadas e um botão azul
 * de "novo agendamento" no topo — o desenho que um gerador de CRUD faz. Não
 * tinha caminho de volta para a vitrine e o vocabulário era o da recepção
 * ("checked_in", "no_show").
 *
 * Agora é uma pauta: uma linha por visita, régua entre elas, número tabular
 * alinhado à direita — o livro de registo que um salão sempre teve. E o que
 * está por vir vem em primeiro, grande, porque é a única coisa que a cliente
 * abre esta página para ver.
 */
export default async function MinhaContaPage() {
  const sessao = await requireClientSession()
  const marcacoes = await listClientAppointments(sessao.clientId!, 50)

  const agora = Date.now()
  const proximas = marcacoes
    .filter((item) => EM_ABERTO.has(item.status) && item.start.getTime() > agora)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const passadas = marcacoes.filter((item) => !proximas.includes(item))

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="display display-lg">Olá, {primeiroNome(sessao.name)}.</h1>
          <p className="text-muted tnum mt-2 text-sm">{formatPhone(sessao.phone)}</p>
        </div>
        <Link href={href('/marcar')} className={buttonVariants({ size: 'lg' })}>
          Marcar horário
        </Link>
      </header>

      {/* ── o que está por vir ───────────────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="display display-md">O que está por vir</h2>
        <div className="rule-bronze mt-3 w-12" />

        {proximas.length === 0 ? (
          <p className="text-body mt-6 text-[0.9375rem]">
            Não tem nenhuma visita marcada. Quando marcar, ela aparece aqui — e pode cancelar ou
            remarcar por esta página.
          </p>
        ) : (
          <ul className="mt-6 border-t border-(--border-strong)">
            {proximas.map((marcacao) => (
              <li key={marcacao.id}>
                <Proxima marcacao={marcacao} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── o que já foi ─────────────────────────────────────────────────── */}
      {passadas.length > 0 ? (
        <section className="mt-14">
          <h2 className="display display-md">Já esteve connosco</h2>
          <div className="rule-bronze mt-3 w-12" />

          <ul className="mt-6 border-t border-(--border-subtle)">
            {passadas.map((marcacao) => (
              <li
                key={marcacao.id}
                className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 border-b border-(--border-subtle) py-3"
              >
                <span className="min-w-0">
                  <span className="text-[0.9375rem] first-letter:uppercase">
                    {formatDateLong(dataDeParede(marcacao))}
                  </span>
                  <span className="text-muted block text-[0.8125rem]">
                    {marcacao.items.map((item) => item.serviceName).join(', ')} · {marcacao.unitName}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-[0.9375rem]">
                    {formatMoney(marcacao.totalPrice)}
                  </span>
                  <span className="text-muted block text-[0.75rem]">
                    {ESTADO[marcacao.status] ?? marcacao.status}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-14 border-t border-(--border-subtle) pt-6">
        <form action={sair}>
          <button
            type="submit"
            className="rounded-plate text-muted min-h-11 text-sm underline-offset-4 transition-colors hover:text-(--text-strong) hover:underline"
          >
            Terminar sessão
          </button>
        </form>
      </div>
    </div>
  )
}

/**
 * A visita que ainda vai acontecer.
 *
 * Hora grande e à esquerda, como num bilhete: é o dado que a cliente vem
 * conferir. O resto é apoio.
 */
function Proxima({ marcacao }: { marcacao: AppointmentView }) {
  const podeCancelar = ['draft', 'scheduled', 'confirmed'].includes(marcacao.status)

  return (
    <article className="border-b border-(--border-subtle) py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-[1.0625rem] font-medium first-letter:uppercase">
            {formatDateLong(dataDeParede(marcacao))}
          </p>
          <p className="tnum text-body mt-0.5 text-[0.9375rem]">
            {formatTime(marcacao.start, marcacao.timezone)}
            <span className="text-muted"> · {marcacao.unitName}</span>
          </p>
        </div>

        <div className="text-right">
          <p className="tnum display text-[1.5rem] leading-none">
            {formatMoney(marcacao.totalPrice)}
          </p>
          <p className="text-muted mt-1 text-[0.75rem]">
            {ESTADO[marcacao.status] ?? marcacao.status}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {marcacao.items.map((item) => (
          <li key={item.id} className="text-body flex items-baseline gap-3 text-[0.875rem]">
            <span className="tnum text-muted w-11 shrink-0">
              {formatTime(item.start, marcacao.timezone)}
            </span>
            <span className="min-w-0">
              {item.serviceName}
              <span className="text-muted"> com {item.staffName}</span>
            </span>
          </li>
        ))}
      </ul>

      {marcacao.clientNote ? (
        <p className="text-muted mt-3 text-[0.8125rem] italic">“{marcacao.clientNote}”</p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <Link
          href={href(`/marcar?casa=${marcacao.unitSlug}`)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Marcar outra
        </Link>
        {podeCancelar ? <BotaoCancelar id={marcacao.id} /> : null}
      </div>
    </article>
  )
}

/** A data como o calendário da casa a vê, não como o servidor em UTC a vê. */
function dataDeParede(marcacao: AppointmentView): string {
  return marcacao.start.toLocaleDateString('en-CA', { timeZone: marcacao.timezone })
}

function primeiroNome(nome: string): string {
  return nome.split(' ')[0] ?? nome
}
