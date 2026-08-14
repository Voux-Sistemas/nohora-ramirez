import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { requireClientSession } from '@/server/auth/session'
import { sair } from '@/server/auth/actions'
import { listClientAppointments } from '@/server/scheduling/queries'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { CancelButton } from '@/components/auth/cancel-button'

export const metadata = { title: 'A minha conta' }

const OPEN_STATUSES = new Set(['draft', 'scheduled', 'confirmed', 'checked_in', 'in_progress'])

export default async function ContaPage() {
  const session = await requireClientSession()
  const appointments = await listClientAppointments(session.clientId!, 50)

  const upcoming = appointments
    .filter((a) => OPEN_STATUSES.has(a.status) && a.start.getTime() > Date.now())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const history = appointments.filter((a) => !upcoming.includes(a))

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Olá, {session.name.split(' ')[0]}</h1>
          <p className="text-muted mt-1 text-sm">As suas marcações e histórico.</p>
        </div>
        <form action={sair}>
          <Button type="submit" variant="ghost" size="sm">
            Sair
          </Button>
        </form>
      </header>

      <div className="mb-6">
        <Link href={href('/agendar')} className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          + Nova marcação
        </Link>
      </div>

      <section className="surface rounded-card mb-6 p-5">
        <h2 className="mb-4 font-medium">Próximas marcações</h2>
        <ul className="flex flex-col gap-3">
          {upcoming.map((a) => (
            <li key={a.id} className="border-b border-(--border-subtle) pb-3 text-sm last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {formatDateLong(isoDateInZone(a.start, a.timezone))}
                </span>
                <span className="text-muted">
                  {formatTime(a.start, a.timezone)} · {a.unitName}
                </span>
              </div>
              <p className="text-muted mt-0.5">
                {a.items.map((i) => i.serviceName).join(', ')} — {formatMoney(a.totalPrice)}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-muted text-xs">{STATUS_LABEL[a.status] ?? a.status}</span>
                <CancelButton id={a.id} />
              </div>
            </li>
          ))}
          {upcoming.length === 0 ? (
            <li className="text-muted text-sm">Nenhuma marcação.</li>
          ) : null}
        </ul>
      </section>

      <section className="surface rounded-card p-5">
        <h2 className="mb-4 font-medium">Histórico</h2>
        <ul className="flex flex-col gap-3">
          {history.map((a) => (
            <li key={a.id} className="border-b border-(--border-subtle) pb-3 text-sm last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {formatDateLong(isoDateInZone(a.start, a.timezone))}
                </span>
                <span className="text-muted">
                  {formatTime(a.start, a.timezone)} · {a.unitName}
                </span>
              </div>
              <p className="text-muted mt-0.5">
                {a.items.map((i) => i.serviceName).join(', ')} — {formatMoney(a.totalPrice)}
              </p>
              <span className="text-muted text-xs">{STATUS_LABEL[a.status] ?? a.status}</span>
            </li>
          ))}
          {history.length === 0 ? (
            <li className="text-muted text-sm">Nenhuma visita ainda.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
