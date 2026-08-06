import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell, Section, backTo } from '@/components/admin/shell'
import { PasswordForm } from '@/components/admin/password-form'
import { Button } from '@/components/ui/button'
import { listServicesAdmin } from '@/server/admin/services'
import { getStaffAdmin, type StaffDetail } from '@/server/admin/staff'
import { listUnitsAdmin } from '@/server/admin/units'
import { salvarEscala, salvarProfissional } from './actions'

const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const BLANK_STAFF: StaffDetail = {
  id: '',
  userId: '',
  name: '',
  phone: '',
  email: null,
  bio: null,
  color: '#95663a',
  acceptsOnlineBooking: true,
  active: true,
  unitIds: [],
  serviceIds: [],
}

export default async function ProfissionalFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isNew = id === 'novo'

  const [data, units, services] = await Promise.all([
    isNew ? null : getStaffAdmin(id),
    listUnitsAdmin(),
    listServicesAdmin(),
  ])
  if (!isNew && !data) notFound()

  const staff = data?.staff ?? BLANK_STAFF
  const unitIds = new Set(staff.unitIds)
  const serviceIds = new Set(staff.serviceIds)
  const schedule = data?.schedule ?? []
  const scheduleByWeekday = new Map(schedule.map((s) => [s.weekday, s]))

  return (
    <AdminShell active="/admin/equipe" title={isNew ? 'Novo profissional' : staff.name}>
      <Link href={backTo('/admin/equipe')} className="text-muted mb-4 inline-block text-sm hover:underline">
        ← equipe
      </Link>

      <form action={salvarProfissional}>
        <input type="hidden" name="id" value={id} />

        <Section title="Dados">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Nome
              <input className="field" name="name" defaultValue={staff.name} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Telefone
              <input className="field" name="phone" defaultValue={staff.phone} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              E-mail
              <input className="field" name="email" type="email" defaultValue={staff.email ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Cor na agenda
              <input className="field h-11" type="color" name="color" defaultValue={staff.color} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Bio
              <textarea className="field" name="bio" rows={2} defaultValue={staff.bio ?? ''} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="acceptsOnlineBooking" defaultChecked={staff.acceptsOnlineBooking} />
              Pode ser escolhido no agendamento online
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={staff.active} />
              Ativo
            </label>
          </div>
        </Section>

        <Section title="Unidades" hint="Onde este profissional atende.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {units.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="unitIds" value={u.id} defaultChecked={unitIds.has(u.id)} />
                {u.name}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Serviços que executa">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="serviceIds" value={s.id} defaultChecked={serviceIds.has(s.id)} />
                {s.name}
              </label>
            ))}
            {services.length === 0 ? (
              <p className="text-muted text-sm">Nenhum serviço cadastrado ainda.</p>
            ) : null}
          </div>
        </Section>

        <Button type="submit" size="lg">
          Salvar profissional
        </Button>
      </form>

      {isNew ? null : (
        <Section
          title="Escala semanal"
          hint="Um turno por dia. Trocar aqui fecha a escala anterior a partir de hoje e abre esta — a agenda já marcada no passado não muda."
        >
          <form action={salvarEscala} className="flex flex-col gap-3">
            <input type="hidden" name="staffId" value={staff.id} />
            {WEEKDAY_LABEL.map((label, weekday) => {
              const row = scheduleByWeekday.get(weekday)
              return (
                <div key={weekday} className="grid grid-cols-[100px_1fr_1fr_1fr] items-center gap-3 text-sm">
                  <span className="text-muted">{label}</span>
                  <select className="field" name={`sc${weekday}_unit`} defaultValue={row?.unitId ?? ''}>
                    <option value="">Folga</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input className="field" type="time" name={`sc${weekday}_start`} defaultValue={row?.startsAt ?? ''} />
                  <input className="field" type="time" name={`sc${weekday}_end`} defaultValue={row?.endsAt ?? ''} />
                </div>
              )
            })}
            <div>
              <Button type="submit" variant="outline">
                Salvar escala
              </Button>
            </div>
          </form>
        </Section>
      )}

      {isNew ? null : (
        <Section
          title="Acesso ao sistema"
          hint="Senha para este profissional entrar em /entrar com o telefone cadastrado."
        >
          <PasswordForm userId={staff.userId} staffId={staff.id} />
        </Section>
      )}
    </AdminShell>
  )
}
