import { notFound } from 'next/navigation'
import { AdminShell, Ficha, Section } from '@/components/admin/shell'
import { FormActions } from '@/components/admin/form-actions'
import { ImageField } from '@/components/admin/image-field'
import { FormComEstado } from '@/components/ui/form-com-estado'
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
  onlineBookable: true,
  active: true,
  imageUrl: null,
}

export default async function ServicoFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ foto?: string }>
}) {
  const { id } = await params
  /* Só chega aqui quando o serviço ficou gravado e a fotografia não subiu —
     ver o fim de `salvarServico`. A pessoa está na ficha do serviço que já
     existe, portanto tentar outra vez edita em vez de duplicar. */
  const fotoFalhou = (await searchParams).foto === 'falhou'
  const acesso = await requireRede()
  const isNew = id === 'novo'

  const [data, categories, equipa] = await Promise.all([
    isNew ? null : getServiceAdmin(id),
    listCategories(),
    listAssignables(),
  ])
  if (!isNew && !data) notFound()

  const service = data?.service ?? BLANK_SERVICE
  const staffIds = new Set(data?.staffIds ?? [])

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/servicos"
      title={isNew ? 'Novo serviço' : service.name}
      meta={isNew ? undefined : (service.categoryName ?? undefined)}
    >
      <Ficha voltarPara="/admin/servicos" voltarLabel="serviços">
        <FormComEstado action={salvarServico}>
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
              {/* Os dois interruptores que sobraram do que era a secção
                  "Regras". Ficam aqui, ao lado do nome e do preço, porque é
                  isso que são: o serviço existe, e o serviço está à vista da
                  cliente. Tudo o resto que aquela secção pedia — avaliação
                  prévia, ficha de anamnese, sinal — descrevia um salão que não
                  é este, e nenhum dos 67 serviços tinha um só deles marcado. */}
              <div className="mt-6 flex flex-col gap-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={service.active} />
                  Serviço ativo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="onlineBookable"
                    defaultChecked={service.onlineBookable}
                  />
                  Aparece na marcação online da cliente (desmarque para “só receção”)
                </label>
              </div>
            </div>
          </Section>

          {/*
          Um número só, e agora mesmo um só campo. O banco guarda a duração em
          três partes e ainda tem os dois intervalos de folga à volta, herança de
          um encaixe que o produto não oferece: o formulário escreve tudo na
          primeira parte e zera o resto, então a agenda enxerga um bloco
          contínuo. Serviço antigo com as partes preenchidas aparece aqui somado,
          e guardar já o normaliza.
        */}
          <Section
            title="Duração"
            hint="Quanto tempo a profissional fica com a cliente, do começo ao fim."
          >
            <label className="flex max-w-40 flex-col gap-1 text-sm">
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
            {fotoFalhou ? (
              <p className="mb-4 text-sm text-(--estado-mau)" role="alert">
                O serviço ficou guardado, mas a fotografia não subiu. Escolha-a outra vez.
              </p>
            ) : null}
            <ImageField
              name="imagem"
              current={service.imageUrl}
              aspect="aspect-square"
              label="Foto"
            />
          </Section>

          <Section title="Quem executa" hint="Profissionais habilitados para este serviço.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {equipa.staff.map((s) => (
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
              {equipa.staff.length === 0 ? (
                <p className="text-muted text-sm">Nenhum profissional ativo registado ainda.</p>
              ) : null}
            </div>
          </Section>

          <FormActions label="Guardar serviço" />
        </FormComEstado>
      </Ficha>
    </AdminShell>
  )
}
