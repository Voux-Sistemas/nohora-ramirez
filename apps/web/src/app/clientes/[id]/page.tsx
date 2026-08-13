import Link from 'next/link'
import { notFound } from 'next/navigation'
import { STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatPhone, formatTime } from '@/lib/format'
import { href } from '@/lib/utils'
import { listAssignables } from '@/server/admin/services'
import { listUnitsAdmin } from '@/server/admin/units'
import { getClientProfile, listClientNotes } from '@/server/people/clients'
import { listClientAppointments } from '@/server/scheduling/queries'
import { alternarFixarNota, atualizarCliente, adicionarNota, removerNota } from './actions'

const CANCELLED = new Set(['cancelled_by_client', 'cancelled_by_studio', 'no_show'])

export default async function ClienteFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [profile, notes, history, units, assignables] = await Promise.all([
    getClientProfile(id),
    listClientNotes(id),
    listClientAppointments(id),
    listUnitsAdmin(),
    listAssignables(),
  ])
  if (!profile) notFound()

  const visits = history.filter((a) => !CANCELLED.has(a.status))
  const noShows = history.filter((a) => a.status === 'no_show').length

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href={href('/clientes')} className="text-muted text-sm hover:underline">
        ← clientes
      </Link>

      <header className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{profile.name}</h1>
          <p className="text-muted mt-1 text-sm">
            <a
              className="hover:text-(--text-strong) transition-colors"
              href={`tel:${profile.phone}`}
            >
              {formatPhone(profile.phone)}
            </a>
            {profile.email ? <> · {profile.email}</> : null}
          </p>
        </div>
        <dl className="flex gap-4 text-center text-sm">
          <div>
            <dd className="tnum text-xl font-semibold">{visits.length}</dd>
            <dt className="text-muted text-xs">visitas</dt>
          </div>
          <div>
            <dd className="tnum text-xl font-semibold">{noShows}</dd>
            <dt className="text-muted text-xs">faltas</dt>
          </div>
        </dl>
      </header>

      {profile.tags.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-(--surface-sunken) px-2.5 py-0.5 text-xs">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <section className="surface rounded-card mb-6 p-5">
        <h2 className="mb-4 font-medium">Dados</h2>
        <form action={atualizarCliente} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={profile.clientId} />
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input className="field" name="name" defaultValue={profile.name} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Telefone
            <input className="field" name="phone" defaultValue={profile.phone} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input className="field" name="email" type="email" defaultValue={profile.email ?? ''} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Nascimento
            <input className="field" type="date" name="birthdate" defaultValue={profile.birthdate ?? ''} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Documento
            <input className="field" name="document" defaultValue={profile.document ?? ''} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Como conheceu
            <input className="field" name="howFoundUs" defaultValue={profile.howFoundUs ?? ''} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Unidade preferida
            <select className="field" name="preferredUnitId" defaultValue={profile.preferredUnitId ?? ''}>
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Profissional preferido
            <select className="field" name="preferredStaffId" defaultValue={profile.preferredStaffId ?? ''}>
              <option value="">—</option>
              {assignables.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            Tags (separadas por vírgula)
            <input className="field" name="tags" defaultValue={profile.tags.join(', ')} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requiresDeposit" defaultChecked={profile.requiresDeposit} />
            Exigir sinal ao agendar
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </section>

      <section className="surface rounded-card mb-6 p-5">
        <h2 className="mb-4 font-medium">Observações internas</h2>
        <ul className="mb-4 flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-(--border-subtle) p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p>{note.body}</p>
                <div className="flex shrink-0 gap-2">
                  <form action={alternarFixarNota}>
                    <input type="hidden" name="clientId" value={profile.clientId} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {note.pinned ? '★' : '☆'}
                    </Button>
                  </form>
                  <form action={removerNota}>
                    <input type="hidden" name="clientId" value={profile.clientId} />
                    <input type="hidden" name="noteId" value={note.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      remover
                    </Button>
                  </form>
                </div>
              </div>
              <p className="text-muted mt-1 text-xs">
                {note.authorName ?? 'recepção'} · {formatDateLong(note.createdAt.toISOString().slice(0, 10))}
              </p>
            </li>
          ))}
          {notes.length === 0 ? <li className="text-muted text-sm">Nenhuma observação ainda.</li> : null}
        </ul>
        <form action={adicionarNota} className="flex flex-col gap-2">
          <input type="hidden" name="clientId" value={profile.clientId} />
          <textarea className="field" name="body" rows={2} placeholder="Nova observação…" required />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="pinned" />
              Fixar
            </label>
            <Button type="submit" variant="outline" size="sm">
              + adicionar
            </Button>
          </div>
        </form>
      </section>

      <section className="surface rounded-card p-5">
        <h2 className="mb-4 font-medium">Histórico de visitas</h2>
        <ul className="flex flex-col gap-3">
          {history.map((a) => (
            <li key={a.id} className="border-b border-(--border-subtle) pb-3 text-sm last:border-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{formatDateLong(a.start.toISOString().slice(0, 10))}</span>
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
          {history.length === 0 ? <li className="text-muted text-sm">Nenhuma visita registrada ainda.</li> : null}
        </ul>
      </section>
    </div>
  )
}
