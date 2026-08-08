import Link from 'next/link'
import type { AppointmentView } from '@/server/scheduling/queries'
import { cancelarAgendamento, mudarStatus } from '@/server/scheduling/actions'
import { formatBRL, formatPhone, formatTime } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'

/**
 * O painel que abre ao tocar num atendimento.
 *
 * Só mostra a ação que faz sentido no estado atual: quem já está em atendimento
 * não pode "fazer check-in", e ninguém cancela o que já foi concluído. É de
 * propósito — na recepção o erro caro é o toque errado com a cliente na frente.
 *
 * `gerir` corta o painel em dois. A profissional toca no andamento do próprio
 * atendimento — chegou, comecei, terminei — porque é ela quem sabe. Remarcar,
 * cancelar e fechar comanda saem: mover cliente exige ver a agenda das colegas,
 * e comanda é caixa. A ficha da cliente também sai, porque a carteira inteira
 * não é dela; o nome e o telefone de quem está na cadeira continuam aqui.
 */

export const STATUS_LABEL: Record<string, string> = {
  draft: 'rascunho',
  scheduled: 'agendado',
  confirmed: 'confirmado',
  checked_in: 'na recepção',
  in_progress: 'em atendimento',
  completed: 'concluído',
  cancelled_by_client: 'cancelado pela cliente',
  cancelled_by_studio: 'cancelado pelo estúdio',
  no_show: 'não compareceu',
}

const NEXT_STEP: Record<string, { to: string; label: string }[]> = {
  scheduled: [
    { to: 'confirmed', label: 'Confirmar' },
    { to: 'checked_in', label: 'Check-in' },
  ],
  confirmed: [{ to: 'checked_in', label: 'Check-in' }],
  checked_in: [{ to: 'in_progress', label: 'Iniciar' }],
  in_progress: [{ to: 'completed', label: 'Concluir' }],
}

const CLOSED = new Set([
  'completed',
  'cancelled_by_client',
  'cancelled_by_studio',
  'no_show',
])

export function AppointmentPanel({
  appointment,
  timezone,
  closeHref,
  unitSlug,
  gerir = true,
}: {
  appointment: AppointmentView
  timezone: string
  closeHref: string
  unitSlug: string
  /** Falso para quem só cuida do próprio atendimento. */
  gerir?: boolean
}) {
  const steps = NEXT_STEP[appointment.status] ?? []
  const open = !CLOSED.has(appointment.status)

  return (
    /*
      `self-start`, não a altura da linha. Como item de grade o painel esticava
      até o pé da prancheta — uma placa de novecentos pixels com trezentos de
      conteúdo e o resto vazio, que é o desenho que faz a tela parecer inacabada.
      Ele passa a ter a altura do que carrega e a grudar no alto: a recepção rola
      a tarde inteira sem perder de vista a ficha que abriu.
    */
    <aside className="surface rounded-card self-start p-5 lg:sticky lg:top-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {gerir ? (
              <Link href={href(`/clientes/${appointment.clientId}`)} className="hover:underline">
                {appointment.clientName}
              </Link>
            ) : (
              appointment.clientName
            )}
          </h2>
          <p className="text-muted text-sm">
            <a
              className="hover:text-(--text-strong) transition-colors"
              href={`tel:${appointment.clientPhone}`}
            >
              {formatPhone(appointment.clientPhone)}
            </a>
          </p>
        </div>
        <Link href={href(closeHref)} scroll={false} className="text-muted text-sm hover:underline">
          fechar
        </Link>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-(--surface-sunken) px-2.5 py-0.5 text-xs">
          {STATUS_LABEL[appointment.status] ?? appointment.status}
        </span>
        <span className="tnum">
          {formatTime(appointment.start, timezone)}–{formatTime(appointment.end, timezone)}
        </span>
      </p>

      <ul className="mt-4 space-y-2 text-sm">
        {appointment.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span>
              <span className="tnum text-muted mr-2">{formatTime(item.start, timezone)}</span>
              {item.serviceName}
              <span className="text-muted"> · {item.staffName}</span>
              {item.durationProfile?.processingMin ? (
                <span className="text-muted"> · {item.durationProfile.processingMin}min de processo</span>
              ) : null}
            </span>
            <span className="tnum shrink-0">{formatBRL(item.price)}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-baseline justify-between border-t border-(--border-subtle) pt-3 font-medium">
        <span>Total</span>
        <span className="tnum">{formatBRL(appointment.totalPrice)}</span>
      </p>

      {appointment.depositRequired > 0 ? (
        <p className="text-muted mt-1 text-sm">
          Sinal de {formatBRL(appointment.depositRequired)} ·{' '}
          {appointment.depositPaidAt ? 'pago' : 'em aberto'}
        </p>
      ) : null}

      {appointment.clientNote ? (
        <p className="mt-4 rounded-lg bg-(--surface-sunken) p-3 text-sm">
          <span className="text-muted block text-xs">observação da cliente</span>
          {appointment.clientNote}
        </p>
      ) : null}

      {appointment.cancellationReason ? (
        <p className="text-muted mt-4 text-sm">Motivo: {appointment.cancellationReason}</p>
      ) : null}

      {gerir && appointment.status === 'completed' ? (
        <div className="mt-5">
          <Link
            href={href(`/agenda/${unitSlug}/comanda/${appointment.id}`)}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Fechar comanda
          </Link>
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <form key={step.to} action={mudarStatus}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="para" value={step.to} />
                <button className={cn(buttonVariants({ size: 'sm' }))}>{step.label}</button>
              </form>
            ))}
            {gerir ? (
              <Link
                href={`/agenda/${unitSlug}/remarcar/${appointment.id}`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                Remarcar
              </Link>
            ) : null}
          </div>

          {/*
            A regra é uma frase: quem atende empurra o próprio atendimento para
            frente; desfazer é da gerência. Cancelar e marcar falta mudam o que
            a loja cobra e o que ela avisa para a cliente — e quem responde por
            isso é quem responde pela loja.
          */}
          {gerir ? (
            <form action={cancelarAgendamento} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={appointment.id} />
              <input
                name="motivo"
                placeholder="motivo (opcional)"
                className="h-9 min-w-40 flex-1 rounded-lg border border-(--border-subtle) bg-(--surface-raised) px-3 text-sm"
              />
              <button
                name="para"
                value="cancelled_by_client"
                className={cn(buttonVariants({ variant: 'danger', size: 'sm' }))}
              >
                Cancelar
              </button>
              <button
                name="para"
                value="no_show"
                className={cn(buttonVariants({ variant: 'danger', size: 'sm' }))}
              >
                Não veio
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
