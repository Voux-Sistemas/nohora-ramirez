import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdminShell, Section, backTo } from '@/components/admin/shell'
import { ImageField } from '@/components/admin/image-field'
import { Button } from '@/components/ui/button'
import { getUnitAdmin, type HoursRow, type UnitRow } from '@/server/admin/units'
import { requireRede } from '@/server/auth/permissoes'
import { adicionarExcecao, removerExcecao, salvarUnidade } from './actions'

const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const BLANK_UNIT: UnitRow = {
  id: '',
  name: '',
  slug: '',
  phone: null,
  email: null,
  addressLine: null,
  district: null,
  city: null,
  state: null,
  postalCode: null,
  timezone: 'America/Sao_Paulo',
  active: true,
  imageUrl: null,
  settings: {
    minLeadMin: 120,
    maxLeadDays: 60,
    granularityMin: 15,
    cancellationWindowHours: 24,
    interServiceGapMin: 0,
  },
}

function slotsFor(weekday: number, hours: readonly HoursRow[]) {
  const rows = hours.filter((h) => h.weekday === weekday)
  return [rows[0] ?? null, rows[1] ?? null] as const
}

export default async function UnidadeFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await requireRede()
  const isNew = id === 'nova'

  const data = isNew ? null : await getUnitAdmin(id)
  if (!isNew && !data) notFound()

  const unit = data?.unit ?? BLANK_UNIT
  const hours = data?.hours ?? []
  const exceptions = data?.exceptions ?? []

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/unidades"
      title={isNew ? 'Nova unidade' : unit.name}
      subtitle={isNew ? undefined : `/${unit.slug}`}
    >
      <Link href={backTo('/admin/unidades')} className="text-muted mb-4 inline-block text-sm hover:underline">
        ← unidades
      </Link>

      <form action={salvarUnidade}>
        <input type="hidden" name="id" value={id} />

        <Section title="Dados">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Nome
              <input className="field" name="name" defaultValue={unit.name} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Slug (URL)
              {/*
                O hífen vai escapado de propósito. O Chrome compila `pattern`
                com a flag `v`, onde `-` solto dentro da classe é erro de
                sintaxe — e o navegador então descarta a regra inteira em
                silêncio, deixando passar "Jardins Paulista" como slug.
              */}
              <input className="field" name="slug" defaultValue={unit.slug} required pattern="[a-z0-9\-]+" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Telefone
              <input className="field" name="phone" defaultValue={unit.phone ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              E-mail
              <input className="field" name="email" type="email" defaultValue={unit.email ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Endereço
              <input className="field" name="addressLine" defaultValue={unit.addressLine ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Bairro
              <input className="field" name="district" defaultValue={unit.district ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Cidade
              <input className="field" name="city" defaultValue={unit.city ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Estado (UF)
              <input className="field" name="state" maxLength={2} defaultValue={unit.state ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              CEP
              <input className="field" name="postalCode" defaultValue={unit.postalCode ?? ''} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Fuso horário
              <input className="field" name="timezone" defaultValue={unit.timezone} required />
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={unit.active} />
              Unidade ativa
            </label>
          </div>
        </Section>

        {/*
          A cliente escolhe a unidade olhando a sala, não o CEP — por isso a
          foto tem seção própria e aparece no mesmo 4:5 em que ela vai ver.
        */}
        <Section
          title="Foto da unidade"
          hint="Aparece na primeira tela do agendamento, do tamanho de um cartão. Vale uma foto da sala com luz acesa e sem gente de costas."
        >
          <ImageField
            name="imagem"
            current={unit.imageUrl}
            label="Foto"
            hint="JPG, PNG, WebP ou AVIF, até 8 MB. Deitada ou em pé, o corte é feito na hora de mostrar."
          />
        </Section>

        <Section
          title="Regras de agendamento"
          hint="Valem para o agendamento online do cliente. A recepção pode ignorar essas regras no encaixe."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <label className="flex flex-col gap-1 text-sm">
              Antecedência mín. (min)
              <input
                className="field"
                type="number"
                min={0}
                name="minLeadMin"
                defaultValue={unit.settings.minLeadMin}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Antecedência máx. (dias)
              <input
                className="field"
                type="number"
                min={1}
                name="maxLeadDays"
                defaultValue={unit.settings.maxLeadDays}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Granularidade (min)
              <input
                className="field"
                type="number"
                min={5}
                step={5}
                name="granularityMin"
                defaultValue={unit.settings.granularityMin}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Janela de cancelamento (h)
              <input
                className="field"
                type="number"
                min={0}
                name="cancellationWindowHours"
                defaultValue={unit.settings.cancellationWindowHours}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Intervalo entre serviços (min)
              <input
                className="field"
                type="number"
                min={0}
                name="interServiceGapMin"
                defaultValue={unit.settings.interServiceGapMin}
              />
            </label>
          </div>
        </Section>

        <Section title="Horário de funcionamento" hint="Deixe o 2º turno em branco se não houver intervalo.">
          <div className="flex flex-col gap-3">
            {WEEKDAY_LABEL.map((label, weekday) => {
              const [first, second] = slotsFor(weekday, hours)
              return (
                <div key={weekday} className="grid grid-cols-[100px_1fr_1fr] items-center gap-3 text-sm">
                  <span className="text-muted">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      className="field"
                      type="time"
                      name={`h${weekday}_1_start`}
                      defaultValue={first?.opensAt ?? ''}
                    />
                    <span className="text-muted">–</span>
                    <input
                      className="field"
                      type="time"
                      name={`h${weekday}_1_end`}
                      defaultValue={first?.closesAt ?? ''}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      className="field"
                      type="time"
                      name={`h${weekday}_2_start`}
                      defaultValue={second?.opensAt ?? ''}
                    />
                    <span className="text-muted">–</span>
                    <input
                      className="field"
                      type="time"
                      name={`h${weekday}_2_end`}
                      defaultValue={second?.closesAt ?? ''}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Button type="submit" size="lg">
          Salvar unidade
        </Button>
      </form>

      {isNew ? null : (
        <Section
          title="Exceções"
          hint="Feriados, eventos e horários especiais — sobrepõem o funcionamento normal."
        >
          <ul className="mb-4 flex flex-col gap-2">
            {exceptions.map((ex) => (
              <li
                key={ex.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-(--border-subtle) px-3 py-2 text-sm"
              >
                <span>
                  <strong>{ex.date}</strong>{' '}
                  {ex.closed ? 'fechado' : `${ex.opensAt ?? '?'}–${ex.closesAt ?? '?'}`}
                  {ex.reason ? ` · ${ex.reason}` : ''}
                </span>
                <form action={removerExcecao}>
                  <input type="hidden" name="id" value={ex.id} />
                  <input type="hidden" name="unitId" value={unit.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    remover
                  </Button>
                </form>
              </li>
            ))}
            {exceptions.length === 0 ? <li className="text-muted text-sm">Nenhuma exceção cadastrada.</li> : null}
          </ul>

          <form action={adicionarExcecao} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <input type="hidden" name="unitId" value={unit.id} />
            <label className="flex flex-col gap-1 text-sm">
              Data
              <input className="field" type="date" name="date" required />
            </label>
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input type="checkbox" name="closed" defaultChecked />
              Fechado o dia todo
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Abre (se não fechado)
              <input className="field" type="time" name="opensAt" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Fecha (se não fechado)
              <input className="field" type="time" name="closesAt" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Motivo
              <input className="field" name="reason" placeholder="Feriado, reforma…" />
            </label>
            <div className="col-span-2 sm:col-span-5">
              <Button type="submit" variant="outline" size="sm">
                + adicionar exceção
              </Button>
            </div>
          </form>
        </Section>
      )}
    </AdminShell>
  )
}
