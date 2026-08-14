'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createService,
  getServiceImage,
  setServiceImage,
  updateService,
  type ServiceInput,
} from '@/server/admin/services'
import { assertRede } from '@/server/auth/permissoes'
import { resolveImageField } from '@/server/storage/form'

function parseService(formData: FormData): ServiceInput {
  const requiresDeposit = formData.get('requiresDeposit') === 'on'
  const depositType = String(formData.get('depositType') ?? 'percent') as 'percent' | 'fixed'
  // 'percent' guarda pontos-base (input "50" → 5000); 'fixed' guarda cêntimos
  // (input "50" → 5000 cêntimos = 50 na moeda do país) — mesma conta nos dois casos.
  const depositValue = Math.round(Number(formData.get('depositValueInput') ?? 0) * 100)

  return {
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || undefined,
    categoryId: String(formData.get('categoryId') ?? '').trim() || undefined,
    basePrice: Math.round(Number(formData.get('basePriceReais') ?? 0) * 100),
    /* Duração é um número só no formulário. As três colunas do banco continuam
       existindo por causa do motor de agenda, então a duração inteira vai para
       a primeira e as outras zeram — bloco contínuo, sem encaixe. */
    setupMin: Number(formData.get('durationMin') ?? 0),
    processingMin: 0,
    finishMin: 0,
    bufferBeforeMin: Number(formData.get('bufferBeforeMin') ?? 0),
    bufferAfterMin: Number(formData.get('bufferAfterMin') ?? 0),
    onlineBookable: formData.get('onlineBookable') === 'on',
    requiresDeposit,
    depositType: requiresDeposit ? depositType : undefined,
    depositValue: requiresDeposit ? depositValue : undefined,
    requiresAssessment: formData.get('requiresAssessment') === 'on',
    requiresAnamnesis: formData.get('requiresAnamnesis') === 'on',
    active: formData.get('active') === 'on',
    resourceTypeIds: formData.getAll('resourceTypeIds').map(String),
    staffIds: formData.getAll('staffIds').map(String),
  }
}

export async function salvarServico(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const input = parseService(formData)
  /* Duração zero abriria um serviço que ocupa nada na agenda — a grade
     aceitaria infinitos no mesmo minuto. */
  if (!input.name || input.setupMin < 1) return
  /* Preço e duração valem nas três lojas de uma vez: é decisão da rede. */
  await assertRede()

  const serviceId = id === 'novo' ? await createService(input) : id
  if (id !== 'novo') await updateService(id, input)

  const previous = id === 'novo' ? null : await getServiceImage(serviceId)
  const imageUrl = await resolveImageField(formData, 'imagem', 'servicos', serviceId, previous)
  if (imageUrl !== undefined) await setServiceImage(serviceId, imageUrl)

  revalidatePath('/admin/servicos')
  // o cardápio da cliente é por unidade e há mais de uma; o layout inteiro do
  // agendamento é o menor corte que cobre todas
  revalidatePath('/agendar', 'layout')
  redirect(`/admin/servicos/${serviceId}` as never)
}
