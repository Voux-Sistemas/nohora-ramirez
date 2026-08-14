import { notFound } from 'next/navigation'
import { AdminShell, Ficha, Section } from '@/components/admin/shell'
import { FormActions } from '@/components/admin/form-actions'
import { ImageField } from '@/components/admin/image-field'
import { Button } from '@/components/ui/button'
import { simboloMoeda } from '@/lib/format'
import {
  getServiceAdmin,
  listAssignables,
  listCategories,
  type ServiceRow,
} from '@/server/admin/services'
import { requireRede } from '@/server/auth/permissoes'
import { salvarServico } from './actions'

const BLANK_SERVICE: ServiceRow = {
  id: '',
  name: '',
  description: null,
  categoryId: null,
  categoryName: null,
  basePrice: 0,
  setupMin: 30,
  processingMin: 0,
  finishMin: 0,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  onlineBookable: true,
  requiresDeposit: false,
  depositType: null,
  depositValue: null,
  requiresAssessment: false,
  requiresAnamnesis: false,
  active: true,
  imageUrl: null,
}

export default async function ServicoFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const acesso = await requireRede()
  const isNew = id === 'novo'

  const [data, categories, assignables] = await Promise.all([
    isNew ? null : getServiceAdmin(id),
    listCategories(),
    listAssignables(),
  ])
  if (!isNew && !data) notFound()

  const service = data?.service ?? BLANK_SERVICE
  const resourceTypeIds = new Set(data?.resourceTypeIds ?? [])
  const staffIds = new Set(data?.staffIds ?? [])

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/servicos"
      title={isNew ? 'Novo serviço' : service.name}
      meta={isNew ? undefined : (service.categoryName ?? undefined)}
    >
      <Ficha voltarPara="/admin/servicos" voltarLabel="serviços">
        <form action={salvarServico}>
          <input type="hidden" name="id" value={id} />

          <Section title="Dados">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                Nome
                <input className="field" name="name" defaultValue={service.name} required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Categoria
                <select className="field" name="categoryId" defaultValue={service.categoryId ?? ''}>
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                Descrição
                <textarea
                  className="field"
                  name="description"
                  rows={2}
                  defaultValue={service.description ?? ''}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Preço ({simboloMoeda()})
                <input
                  className="field"
                  type="number"
                  min={0}
                  step="0.01"
                  name="basePriceReais"
                  defaultValue={(service.basePrice / 100).toFixed(2)}
                  required
                />
              </label>
              <label className="mt-6 flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={service.active} />
                Serviço ativo
              </label>
            </div>
          </Section>

          {/*
          Um número só. O banco ainda guarda a duração em três partes, herança
          de um encaixe que o produto não oferece mais; o formulário escreve
          tudo na primeira e zera as outras, então a agenda enxerga um bloco
          contínuo. Serviço antigo com as três partes preenchidas aparece aqui
          somado, e salvar já o normaliza.
        */}
          <Section
            title="Duração"
            hint="Quanto tempo a profissional fica com a cliente, do começo ao fim."
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                Duração (min)
                <input
                  className="field"
                  type="number"
                  min={1}
                  name="durationMin"
                  defaultValue={service.setupMin + service.processingMin + service.finishMin}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Intervalo antes (min)
                <input
                  className="field"
                  type="number"
                  min={0}
                  name="bufferBeforeMin"
                  defaultValue={service.bufferBeforeMin}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Intervalo depois (min)
                <input
                  className="field"
                  type="number"
                  min={0}
                  name="bufferAfterMin"
                  defaultValue={service.bufferAfterMin}
                />
              </label>
            </div>
          </Section>

          {/*
          Quadrada porque no cardápio ela é uma miniatura ao lado do nome, não
          uma capa. Serviço sem foto cai na placa de tinta com as iniciais —
          fica na mesma fileira dos outros sem parecer o que sobrou.
        */}
          <Section
            title="Foto do serviço"
            hint="Aparece ao lado do nome na lista que a cliente escolhe. Um trabalho pronto do próprio salão vale mais que banco de imagem."
          >
            <ImageField
              name="imagem"
              current={service.imageUrl}
              aspect="aspect-square"
              label="Foto"
            />
          </Section>

          <Section title="Regras">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="onlineBookable"
                  defaultChecked={service.onlineBookable}
                />
                Aparece na marcação online da cliente (desmarque para “só receção”)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="requiresAssessment"
                  defaultChecked={service.requiresAssessment}
                />
                Exige avaliação presencial antes de marcar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="requiresAnamnesis"
                  defaultChecked={service.requiresAnamnesis}
                />
                Exige ficha de anamnese
              </label>

              <div className="mt-2 grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="requiresDeposit"
                    defaultChecked={service.requiresDeposit}
                  />
                  Exige sinal
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Tipo
                  <select
                    className="field"
                    name="depositType"
                    defaultValue={service.depositType ?? 'percent'}
                  >
                    <option value="percent">% do serviço</option>
                    <option value="fixed">Valor fixo ({simboloMoeda()})</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  Valor (% ou {simboloMoeda()})
                  <input
                    className="field"
                    type="number"
                    min={0}
                    step="0.01"
                    name="depositValueInput"
                    defaultValue={
                      service.depositValue != null ? (service.depositValue / 100).toFixed(2) : ''
                    }
                  />
                </label>
              </div>
            </div>
          </Section>

          <Section title="Quem executa" hint="Profissionais habilitados para este serviço.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {assignables.staff.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="staffIds"
                    value={s.id}
                    defaultChecked={staffIds.has(s.id)}
                  />
                  {s.name}
                </label>
              ))}
              {assignables.staff.length === 0 ? (
                <p className="text-muted text-sm">Nenhum profissional ativo registado ainda.</p>
              ) : null}
            </div>
          </Section>

          <Section
            title="Recursos exigidos"
            hint="Cabine, lavatório, equipamento — o que a agenda precisa reservar junto."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {assignables.resourceTypes.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="resourceTypeIds"
                    value={r.id}
                    defaultChecked={resourceTypeIds.has(r.id)}
                  />
                  {r.name}
                </label>
              ))}
              {assignables.resourceTypes.length === 0 ? (
                <p className="text-muted text-sm">Nenhum tipo de recurso registado ainda.</p>
              ) : null}
            </div>
          </Section>

          <FormActions label="Guardar serviço" />
        </form>
      </Ficha>
    </AdminShell>
  )
}
