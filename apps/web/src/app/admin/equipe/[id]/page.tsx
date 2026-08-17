import { notFound } from 'next/navigation'
import { AdminShell, Ficha, Section } from '@/components/admin/shell'
import { FormActions } from '@/components/admin/form-actions'
import { PasswordForm } from '@/components/admin/password-form'
import { StaffForm } from '@/components/admin/staff-form'
import { Button } from '@/components/ui/button'
import { ErroDoForm } from '@/components/ui/erro-do-form'
import { PhoneInput } from '@/components/ui/phone-input'
import { listServicesAdmin } from '@/server/admin/services'
import { getStaffAdmin, type StaffDetail } from '@/server/admin/staff'
import { listUnitsAdmin } from '@/server/admin/units'
import {
  podeRede,
  podeSuporte,
  requireGestao,
  unidadesVisiveis,
  veUnidade,
} from '@/server/auth/permissoes'
import { salvarEscala } from './actions'

const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/* Do mais fraco para o mais forte: a leitura de cima para baixo é a de quem
   vai subindo alguém de degrau, que é o movimento comum. */
const ACESSOS: readonly {
  papel: StaffDetail['papel']
  titulo: string
  explica: string
}[] = [
  {
    papel: 'profissional',
    titulo: 'Profissional',
    explica: 'Entra e vê só a própria agenda.',
  },
  {
    papel: 'gerente',
    titulo: 'Gerente da unidade',
    explica:
      'Toca a operação das lojas marcadas acima: agenda da equipa, caixa, clientes e avisos.',
  },
  {
    papel: 'dona',
    titulo: 'Dona',
    explica:
      'Vê a rede inteira e mexe no registo: unidades, serviços, comissões e o acesso das outras pessoas.',
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

export default async function ProfissionalFormPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const acesso = await requireGestao()
  const rede = podeRede(acesso)
  const suporte = podeSuporte(acesso)
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

  /* E ficha de quem manda em alguma coisa é de quem manda na rede — a mesma
     regra que `autorizarStaff` aplica do lado das ações, aqui à entrada.
     Faltava: o gerente partilha unidade com a patroa, portanto passava no teste
     de cima e abria a ficha dela. Não conseguia gravar (a ação recusa), mas
     lia-lhe o telemóvel e o e-mail com o formulário de palavra-passe à frente —
     e são esses dois campos que a recuperação de acesso usa. A própria ficha
     continua aberta a quem quer que seja: não é degrau acima do dele. */
  if (data && !rede && data.staff.papel !== 'profissional') {
    if (data.staff.userId !== acesso.session.userId) notFound()
  }

  const units = unidadesVisiveis(acesso, todasUnidades)
  const staff = data?.staff ?? BLANK_STAFF
  /* Conceder e retirar o degrau de dona é do suporte, então para a dona a ficha
     de outra dona mostra o degrau sem deixar mexer. */
  const ehDona = staff.papel === 'dona'
  const podeMexerNoPapel = suporte || !ehDona
  const unitIds = new Set(staff.unitIds)
  const serviceIds = new Set(staff.serviceIds)
  const schedule = data?.schedule ?? []
  const scheduleByWeekday = new Map(schedule.map((s) => [s.weekday, s]))

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/equipe"
      title={isNew ? 'Novo profissional' : staff.name}
      meta={
        isNew
          ? undefined
          : [
              ACESSOS.find((opcao) => opcao.papel === staff.papel)?.titulo,
              todasUnidades
                .filter((u) => unitIds.has(u.id))
                .map((u) => u.name)
                .join(', '),
            ]
              .filter(Boolean)
              .join(' · ')
      }
    >
      <Ficha voltarPara="/admin/equipe" voltarLabel="equipa">
        <StaffForm id={id}>
          <Section title="Dados">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Nome
                <input className="field" name="name" defaultValue={staff.name} required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Telefone
                {/* O mesmo campo com máscara que a marcação e o login usam:
                    escrito à mão, o número saía num formato que `toE164`
                    recusava — e a recusa derrubava a página inteira. */}
                <PhoneInput className="field" name="phone" defaultValue={staff.phone} required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                E-mail
                <input
                  className="field"
                  name="email"
                  type="email"
                  defaultValue={staff.email ?? ''}
                />
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
                <input
                  type="checkbox"
                  name="acceptsOnlineBooking"
                  defaultChecked={staff.acceptsOnlineBooking}
                />
                Pode ser escolhido na marcação online
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
                {ACESSOS.filter((opcao) => opcao.papel !== 'dona' || ehDona || suporte).map(
                  (opcao) => (
                    <label key={opcao.papel} className="flex items-start gap-2 text-sm">
                      <input
                        className="mt-1"
                        type="radio"
                        name="papel"
                        value={opcao.papel}
                        defaultChecked={staff.papel === opcao.papel}
                        disabled={!podeMexerNoPapel}
                      />
                      <span>
                        {opcao.titulo}
                        <span className="text-muted block text-xs">{opcao.explica}</span>
                      </span>
                    </label>
                  ),
                )}
              </div>
              {podeMexerNoPapel ? null : (
                <p className="text-muted mt-3 text-sm">
                  Quem é dona só muda de degrau pelo suporte — nem para cima nem para baixo. É o
                  acesso que abre o cadastro da rede inteira, e tirar de volta não é algo que dê
                  para desfazer sozinha aqui de dentro.
                </p>
              )}
            </Section>
          ) : null}

          <Section title="Serviços que executa">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={s.id}
                    defaultChecked={serviceIds.has(s.id)}
                  />
                  {s.name}
                </label>
              ))}
              {services.length === 0 ? (
                <p className="text-muted text-sm">Nenhum serviço registado ainda.</p>
              ) : null}
            </div>
          </Section>

          <ErroDoForm />

          <FormActions label="Guardar profissional" />
        </StaffForm>

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
                    <div
                      key={weekday}
                      className="grid grid-cols-1 gap-1 border-b border-(--border-subtle) pb-3 text-sm last:border-0 last:pb-0 sm:grid-cols-[100px_1fr] sm:items-center sm:gap-3 sm:border-0 sm:pb-0"
                    >
                      <span className="text-(--text-strong) font-medium sm:text-muted sm:font-normal">
                        {label}
                      </span>
                      <span className="text-muted">
                        escalada noutra unidade — {row.startsAt} às {row.endsAt}
                      </span>
                    </div>
                  )
                }

                return (
                  <div
                    key={weekday}
                    className="grid grid-cols-1 gap-2 border-b border-(--border-subtle) pb-3 text-sm last:border-0 last:pb-0 sm:grid-cols-[100px_1fr_1fr_1fr] sm:items-center sm:gap-3 sm:border-0 sm:pb-0"
                  >
                    <span className="text-(--text-strong) font-medium sm:text-muted sm:font-normal">
                      {label}
                    </span>
                    <select
                      className="field"
                      name={`sc${weekday}_unit`}
                      defaultValue={row?.unitId ?? ''}
                    >
                      <option value="">Folga</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="field"
                      type="time"
                      name={`sc${weekday}_start`}
                      defaultValue={row?.startsAt ?? ''}
                    />
                    <input
                      className="field"
                      type="time"
                      name={`sc${weekday}_end`}
                      defaultValue={row?.endsAt ?? ''}
                    />
                  </div>
                )
              })}
              <div>
                <Button type="submit" variant="outline">
                  Guardar escala
                </Button>
              </div>
            </form>
          </Section>
        )}

        {isNew ? null : (
          <Section
            title="Palavra-passe de acesso"
            hint="Palavra-passe para esta pessoa entrar em /entrar com o telefone registado."
          >
            <PasswordForm staffId={staff.id} />
          </Section>
        )}
      </Ficha>
    </AdminShell>
  )
}
