import { notFound } from 'next/navigation'
import { AdminShell, Ficha, Section } from '@/components/admin/shell'
import { FormActions } from '@/components/admin/form-actions'
import { GaleriaDaLoja } from '@/components/admin/gallery'
import { ImageField } from '@/components/admin/image-field'
import { Button } from '@/components/ui/button'
import { pais } from '@/lib/pais'
import { getUnitAdmin, listUnitPhotos, type HoursRow, type UnitRow } from '@/server/admin/units'
import { podeSuporte, requireRede, requireSuporte } from '@/server/auth/permissoes'
import {
  adicionarExcecao,
  adicionarFotos,
  cuidarDaFoto,
  removerExcecao,
  salvarUnidade,
} from './actions'

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
  timezone: pais().fusoPadrao,
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
  const isNew = id === 'nova'
  /* Abrir loja nova é do suporte; a ficha de uma loja que já existe é da dona. */
  const acesso = isNew ? await requireSuporte() : await requireRede()
  const suporte = podeSuporte(acesso)

  const data = isNew ? null : await getUnitAdmin(id)
  if (!isNew && !data) notFound()

  const photos = isNew ? [] : await listUnitPhotos(id)

  const unit = data?.unit ?? BLANK_UNIT
  const hours = data?.hours ?? []
  const exceptions = data?.exceptions ?? []
  const { rotulos, maxRegiao, exemploCodigoPostal } = pais()

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/unidades"
      title={isNew ? 'Nova unidade' : unit.name}
      meta={isNew ? undefined : `/${unit.slug}`}
    >
      <Ficha voltarPara="/admin/unidades" voltarLabel="unidades">
        <form action={salvarUnidade}>
          <input type="hidden" name="id" value={id} />

          <Section title="Dados">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Nome
                <input className="field" name="name" defaultValue={unit.name} required />
              </label>
              {/*
              O slug é o endereço que o salão divulga. Trocar depois quebra em
              silêncio todo link já impresso, então para a dona ele vira texto:
              some o campo, fica o valor e o caminho de quem muda.
            */}
              {suporte ? (
                <label className="flex flex-col gap-1 text-sm">
                  Slug (URL)
                  {/*
                  O hífen vai escapado de propósito. O Chrome compila `pattern`
                  com a flag `v`, onde `-` solto dentro da classe é erro de
                  sintaxe — e o navegador então descarta a regra inteira em
                  silêncio, deixando passar "Jardins Paulista" como slug.
                */}
                  <input
                    className="field"
                    name="slug"
                    defaultValue={unit.slug}
                    required
                    pattern="[a-z0-9\-]+"
                  />
                </label>
              ) : (
                <div className="flex flex-col gap-1 text-sm">
                  Endereço no site
                  <p className="text-muted pt-2">
                    /{unit.slug} — mudar quebra os links já divulgados, então passa pelo suporte.
                  </p>
                </div>
              )}
              <label className="flex flex-col gap-1 text-sm">
                Telefone
                <input className="field" name="phone" defaultValue={unit.phone ?? ''} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                E-mail
                <input
                  className="field"
                  name="email"
                  type="email"
                  defaultValue={unit.email ?? ''}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Morada
                <input className="field" name="addressLine" defaultValue={unit.addressLine ?? ''} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {rotulos.subdivisao}
                <input className="field" name="district" defaultValue={unit.district ?? ''} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Cidade
                <input className="field" name="city" defaultValue={unit.city ?? ''} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {rotulos.regiao}
                <input
                  className="field"
                  name="state"
                  maxLength={maxRegiao}
                  defaultValue={unit.state ?? ''}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {rotulos.codigoPostal}
                <input
                  className="field"
                  name="postalCode"
                  placeholder={exemploCodigoPostal}
                  defaultValue={unit.postalCode ?? ''}
                />
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
          A cliente escolhe a unidade a olhar para a sala, não para o código
          postal — por isso a foto tem secção própria e aparece no mesmo 4:5
          em que ela a vai ver.
        */}
          <Section
            title="Foto da unidade"
            hint="Aparece no primeiro ecrã da marcação, do tamanho de um cartão. Vale uma foto da sala com luz acesa e sem gente de costas."
          >
            <ImageField
              name="imagem"
              current={unit.imageUrl}
              label="Foto"
              hint="JPG, PNG, WebP ou AVIF, até 8 MB. Deitada ou em pé, o corte é feito na hora de mostrar."
            />
          </Section>

          <Section
            title="Regras de marcação"
            hint="Valem para a marcação online da cliente. A receção pode ignorar estas regras no encaixe."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <Section
            title="Horário de funcionamento"
            hint="Deixe o 2º turno em branco se não houver intervalo."
          >
            <div className="flex flex-col gap-3">
              {WEEKDAY_LABEL.map((label, weekday) => {
                const [first, second] = slotsFor(weekday, hours)
                return (
                  <div
                    key={weekday}
                    className="grid grid-cols-1 gap-2 border-b border-(--border-subtle) pb-3 text-sm last:border-0 last:pb-0 sm:grid-cols-[100px_1fr_1fr] sm:items-center sm:gap-3 sm:border-0 sm:pb-0"
                  >
                    <span className="text-(--text-strong) font-medium sm:text-muted sm:font-normal">
                      {label}
                    </span>
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

          <FormActions label="Guardar unidade" />
        </form>

        {/*
        Fora do formulário de cima, como as exceções: cada fotografia é gravada
        no momento em que se mexe nela, e não junto com o resto do cadastro. Um
        `<form>` dentro de outro não é HTML válido, e mesmo que fosse, subir uma
        foto não devia obrigar a salvar o horário de funcionamento.

        Só numa unidade que já existe: a chave do ficheiro no bucket é montada
        com o id da unidade, que numa unidade nova ainda não foi gerado.
      */}
        {isNew ? null : (
          <Section
            title="A casa"
            hint="O ensaio que aparece na página pública da loja, nesta ordem. A primeira é também a que abre a página quando não há foto de capa."
          >
            <GaleriaDaLoja
              unitId={unit.id}
              fotos={photos}
              aoAdicionar={adicionarFotos}
              aoCuidar={cuidarDaFoto}
            />
          </Section>
        )}

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
              {exceptions.length === 0 ? (
                <li className="text-muted text-sm">Nenhuma exceção registada.</li>
              ) : null}
            </ul>

            <form
              action={adicionarExcecao}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
            >
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
      </Ficha>
    </AdminShell>
  )
}
