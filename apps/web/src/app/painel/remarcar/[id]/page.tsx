import { addDaysInZone, isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PainelShell } from '@/components/shell/painel-shell'
import { buttonVariants } from '@/components/ui/button'
import { formatDateLong, formatDuration, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { podeGerir, requireUnidade } from '@/server/auth/permissoes'
import { contextoDoPainel } from '@/server/painel/contexto'
import { findSlots } from '@/server/scheduling/availability'
import { loadBookingContext, staffForCart } from '@/server/scheduling/context'
import { getAppointment } from '@/server/scheduling/queries'
import { remarcar } from './actions'

export const dynamic = 'force-dynamic'

/**
 * Remarcação. O contexto é carregado ignorando a ocupação DESTE atendimento
 * (`excludeAppointmentId`) — sem isso a cliente não conseguiria nem adiantar
 * quinze minutos, porque ela mesma estaria bloqueando o horário vizinho.
 *
 * Tela de gestão: a lista de horários livres é a agenda da equipe inteira lida
 * de outro jeito. Quem só enxerga a própria coluna não passa por aqui.
 */
export default async function RemarcarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ d?: string; p?: string; erro?: string }>
}) {
  const { id } = await params
  const { d, p, erro } = await searchParams

  /* A casa sai do atendimento, não do endereço: remarcar é sempre dentro da
     loja onde a visita está, e ter a loja no caminho só criava a hipótese de
     as duas discordarem. */
  const { acesso, unidades } = await contextoDoPainel()
  if (!podeGerir(acesso)) redirect('/painel/agenda')

  const appointment = await getAppointment(id)
  if (!appointment) notFound()
  requireUnidade(acesso, appointment.unitId)

  const unit = unidades.find((item) => item.id === appointment.unitId)
  if (!unit) notFound()

  const originalDate = isoDateInZone(appointment.start, unit.timezone)
  const date = isValidDate(d) ? d : originalDate
  const serviceIds = appointment.items.map((item) => item.serviceId)
  const staffId = p || undefined

  const ctx = await loadBookingContext({
    unit,
    fromDate: date,
    toDate: date,
    excludeAppointmentId: id,
  })

  const cart = serviceIds.map((serviceId) => ({
    serviceId,
    ...(staffId ? { staffId } : {}),
  }))
  const slots = findSlots(ctx, { cart, ignoreLeadRules: true, limit: 400 })
  const team = staffForCart(ctx, serviceIds)
  const base = `/painel/remarcar/${id}?d=${date}`

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unit}
      activa="hoje"
      titulo={`Remarcar ${appointment.clientName}`}
      semCasa
    >
    <div className="max-w-2xl">
      <Link
        href={href(`/painel?d=${originalDate}&sel=${id}`)}
        className="text-muted text-sm hover:underline"
      >
        ← voltar para a agenda
      </Link>

      {/*
        "Hoje em segunda-feira, 7 de setembro" dizia duas coisas erradas ao
        mesmo tempo: que o atendimento é hoje (não é — é o horário de origem)
        e "em segunda-feira", que ninguém fala. A frase agora diz o que a
        recepção precisa saber antes de escolher outro horário: onde a visita
        está marcada neste momento.
      */}
      <p className="text-muted text-sm">
        Está marcada para {formatDateLong(originalDate)}, às{' '}
        <span className="tnum">{formatTime(appointment.start, unit.timezone)}</span> ·{' '}
        {appointment.items.map((item) => item.serviceName).join(' + ')}
      </p>

      {erro ? (
        <p className="mt-4 rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 px-3 py-2 text-sm text-(--color-signal-bad)">
          {erro}
        </p>
      ) : null}

      <div className="mt-6 mb-4 flex flex-wrap gap-2">
        <Chip to={`/painel/remarcar/${id}?d=${date}`} active={!staffId}>
          Qualquer profissional
        </Chip>
        {team.map((person) => (
          <Chip key={person.id} to={`${base}&p=${person.id}`} active={staffId === person.id}>
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: person.color }}
            />
            {person.name}
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Link
          href={href(`/painel/remarcar/${id}?d=${addDaysInZone(date, -1)}${staffId ? `&p=${staffId}` : ''}`)}
          aria-label="Dia anterior"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ←
        </Link>
        <span className="text-sm font-medium">{formatDateLong(date)}</span>
        <Link
          href={href(`/painel/remarcar/${id}?d=${addDaysInZone(date, 1)}${staffId ? `&p=${staffId}` : ''}`)}
          aria-label="Próximo dia"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          →
        </Link>
      </div>

      {slots.length === 0 ? (
        <p className="text-muted">Nenhum horário livre neste dia.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots.map((slot) => (
            <li key={slot.start}>
              <form action={remarcar}>
                <input type="hidden" name="id" value={id} />
                <input type="hidden" name="unidade" value={unit.slug} />
                <input type="hidden" name="data" value={date} />
                <input type="hidden" name="cliente" value={appointment.clientId} />
                <input type="hidden" name="servicos" value={serviceIds.join(',')} />
                <input type="hidden" name="inicio" value={slot.start} />
                {staffId ? <input type="hidden" name="profissional" value={staffId} /> : null}
                {/* A mesma pastilha de horário da tela da cliente: mesma
                    altura, mesma borda, mesmo afundar de 1px ao clicar. */}
                <button className="tnum rounded-plate flex h-14 w-full items-center justify-center border border-(--border-subtle) bg-(--surface-raised) text-[1.0625rem] font-medium transition-[border-color,background-color,transform] duration-150 hover:border-(--surface-invert) hover:bg-(--surface-sunken) active:translate-y-px">
                  {formatTime(slot.start, unit.timezone)}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted mt-6 text-sm">
        A visita dura cerca de {formatDuration(totalMinutes(appointment))}.
      </p>
    </div>
    </PainelShell>
  )
}

function totalMinutes(appointment: { start: Date; end: Date }): number {
  return Math.round((appointment.end.getTime() - appointment.start.getTime()) / 60_000)
}

function Chip({
  to,
  active,
  children,
}: {
  to: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href(to)}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
        /* Selecionado é tinta, como em todo o resto do sistema — não um lavado
           de vinho de uma paleta que a marca não usa mais. */
        active
          ? 'border-(--surface-invert) bg-(--surface-invert) text-(--on-invert)'
          : 'border-(--border-subtle) hover:bg-(--surface-sunken)',
      )}
    >
      {children}
    </Link>
  )
}

function isValidDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
