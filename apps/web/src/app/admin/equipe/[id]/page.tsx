import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell, Section, backTo } from '@/components/admin/shell'
import { PasswordForm } from '@/components/admin/password-form'
import { Button } from '@/components/ui/button'
import { listServicesAdmin } from '@/server/admin/services'
import { getStaffAdmin, type StaffDetail } from '@/server/admin/staff'
import { listUnitsAdmin } from '@/server/admin/units'
import { podeRede, requireGestao, unidadesVisiveis, veUnidade } from '@/server/auth/permissoes'
import { salvarEscala, salvarProfissional } from './actions'

const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/* Do mais fraco para o mais forte: a leitura de cima para baixo é a de quem
   vai subindo alguém de degrau, que é o movimento comum. */
const ACESSOS: readonly { papel: StaffDetail['papel']; titulo: string; explica: string }[] = [
  {
    papel: 'profissional',
    titulo: 'Profissional',
    explica: 'Entra e vê só a própria agenda.',
  },
  {
    papel: 'gerente',
    titulo: 'Gerente da unidade',
    explica:
      'Toca a operação das lojas marcadas acima: agenda da equipe, caixa, clientes e avisos.',
  },
  {
    papel: 'dona',
    titulo: 'Dona',
    explica:
      'Enxerga a rede inteira e mexe no cadastro: unidades, serviços, comissões e o acesso das outras pessoas.',
  },
]

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
  papel: 'profissional',
}

export default async function ProfissionalFormPage({ params }: { params: Promise<{ id: string }> }) {
  const acesso = await requireGestao()
  const rede = podeRede(acesso)
  const { id } = await params
  const isNew = id === 'novo'

  const [data, todasUnidades, services] = await Promise.all([
    isNew ? null : getStaffAdmin(id),
    listUnitsAdmin(),
    listServicesAdmin(),
  ])
  if (!isNew && !data) notFound()

  /* A ficha é de quem atende nas lojas de quem abriu. Para os outros ela não
     existe — dizer "sem permissão" já entregaria que a pessoa trabalha na rede. */
  if (data && !data.staff.unitIds.some((unitId) => veUnidade(acesso, unitId))) notFound()

  const units = unidadesVisiveis(acesso, todasUnidades)
  const staff = data?.staff ?? BLANK_STAFF
  const unitIds = new Set(staff.unitIds)
  const serviceIds = new Set(staff.serviceIds)
  const schedule = data?.schedule ?? []
  const scheduleByWeekday = new Map(schedule.map((s) => [s.weekday, s]))

  return (
    <AdminShell acesso={acesso} active="/admin/equipe" title={isNew ? 'Novo profissional' : staff.name}>
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
                {/* Quem só responde por uma loja está cadastrando para ela: a
                    caixa já vem marcada, senão o cadastro nasce sem lotação e
                    some da lista de quem acabou de criá-lo. */}
                <input
                  type="checkbox"
                  name="unitIds"
                  value={u.id}
                  defaultChecked={unitIds.has(u.id) || (isNew && units.length === 1)}
                />
                {u.name}
              </label>
            ))}
          </div>
        </Section>

        {/* Nomear gerente ou dona é decisão de quem já é dona: o gerente que
            pudesse promover a si mesmo tornaria o degrau enfeite. */}
        {rede ? (
          <Section title="Acesso ao sistema">
            <div className="flex flex-col gap-3">
              {ACESSOS.map((opcao) => (
                <label key={opcao.papel} className="flex items-start gap-2 text-sm">
                  <input
                    className="mt-1"
                    type="radio"
                    name="papel"
                    value={opcao.papel}
                    defaultChecked={staff.papel === opcao.papel}
                  />
                  <span>
                    {opcao.titulo}
                    <span className="text-muted block text-xs">{opcao.explica}</span>
                  </span>
                </label>
              ))}
            </div>
          </Section>
        ) : null}

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

              /* Dia escalado numa loja fora do alcance de quem edita: mostra, mas
                 não deixa mexer. Se virasse um "Folga" no formulário, salvar a
                 escala apagaria em silêncio um dia de trabalho de outra unidade. */
              if (row && !veUnidade(acesso, row.unitId)) {
                return (
                  <div key={weekday} className="grid grid-cols-[100px_1fr] items-center gap-3 text-sm">
                    <span className="text-muted">{label}</span>
                    <span className="text-muted">
                      escalada em outra unidade — {row.startsAt} às {row.endsAt}
                    </span>
                  </div>
                )
              }

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
          title="Senha de acesso"
          hint="Senha para esta pessoa entrar em /entrar com o telefone cadastrado."
        >
          <PasswordForm staffId={staff.id} />
        </Section>
      )}
    </AdminShell>
  )
}
