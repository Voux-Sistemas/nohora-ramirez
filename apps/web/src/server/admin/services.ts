import 'server-only'

/**
 * Cadastro de serviços: catálogo, categorias, habilidade da equipe e recurso
 * exigido. Preço aqui é sempre o de referência da rede — exceção por unidade
 * ou profissional é outra tela (`service_pricing`), fora deste primeiro corte.
 */

import {
  organizations,
  resourceTypes,
  serviceCategories,
  serviceResourceRequirements,
  services,
  staffProfiles,
  staffSkills,
} from '@studio/db'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'

export interface CategoryRow {
  id: string
  name: string
  sortOrder: number
  active: boolean
}

export interface ServiceRow {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  categoryName: string | null
  basePrice: number
  setupMin: number
  processingMin: number
  finishMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  onlineBookable: boolean
  requiresDeposit: boolean
  depositType: 'percent' | 'fixed' | null
  depositValue: number | null
  requiresAssessment: boolean
  requiresAnamnesis: boolean
  active: boolean
  imageUrl: string | null
}

export async function listCategories(): Promise<CategoryRow[]> {
  const rows = await db
    .select()
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name))
  return rows.map((r) => ({ id: r.id, name: r.name, sortOrder: r.sortOrder, active: r.active }))
}

export async function listServicesAdmin(): Promise<ServiceRow[]> {
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      basePrice: services.basePrice,
      setupMin: services.setupMin,
      processingMin: services.processingMin,
      finishMin: services.finishMin,
      bufferBeforeMin: services.bufferBeforeMin,
      bufferAfterMin: services.bufferAfterMin,
      onlineBookable: services.onlineBookable,
      requiresDeposit: services.requiresDeposit,
      depositType: services.depositType,
      depositValue: services.depositValue,
      requiresAssessment: services.requiresAssessment,
      requiresAnamnesis: services.requiresAnamnesis,
      active: services.active,
      imageUrl: services.imageUrl,
    })
    .from(services)
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .orderBy(asc(services.sortOrder), asc(services.name))
  return rows
}

export async function getServiceAdmin(id: string): Promise<{
  service: ServiceRow
  resourceTypeIds: string[]
  staffIds: string[]
} | null> {
  const rows = await db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
      categoryId: services.categoryId,
      categoryName: serviceCategories.name,
      basePrice: services.basePrice,
      setupMin: services.setupMin,
      processingMin: services.processingMin,
      finishMin: services.finishMin,
      bufferBeforeMin: services.bufferBeforeMin,
      bufferAfterMin: services.bufferAfterMin,
      onlineBookable: services.onlineBookable,
      requiresDeposit: services.requiresDeposit,
      depositType: services.depositType,
      depositValue: services.depositValue,
      requiresAssessment: services.requiresAssessment,
      requiresAnamnesis: services.requiresAnamnesis,
      active: services.active,
      imageUrl: services.imageUrl,
    })
    .from(services)
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(eq(services.id, id))
    .limit(1)
  const service = rows[0]
  if (!service) return null

  const [requirements, skills] = await Promise.all([
    db
      .select({ resourceTypeId: serviceResourceRequirements.resourceTypeId })
      .from(serviceResourceRequirements)
      .where(eq(serviceResourceRequirements.serviceId, id)),
    db
      .select({ staffId: staffSkills.staffId })
      .from(staffSkills)
      .where(eq(staffSkills.serviceId, id)),
  ])

  return {
    service,
    resourceTypeIds: requirements.map((r) => r.resourceTypeId),
    staffIds: skills.map((s) => s.staffId),
  }
}

export interface ServiceInput {
  name: string
  description?: string
  categoryId?: string
  basePrice: number
  setupMin: number
  processingMin: number
  finishMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  onlineBookable: boolean
  requiresDeposit: boolean
  depositType?: 'percent' | 'fixed'
  depositValue?: number
  requiresAssessment: boolean
  requiresAnamnesis: boolean
  active: boolean
  resourceTypeIds: string[]
  staffIds: string[]
}

function serviceValues(input: ServiceInput) {
  return {
    name: input.name,
    description: input.description || null,
    categoryId: input.categoryId || null,
    basePrice: input.basePrice,
    setupMin: input.setupMin,
    processingMin: input.processingMin,
    finishMin: input.finishMin,
    bufferBeforeMin: input.bufferBeforeMin,
    bufferAfterMin: input.bufferAfterMin,
    onlineBookable: input.onlineBookable,
    requiresDeposit: input.requiresDeposit,
    depositType: input.requiresDeposit ? (input.depositType ?? null) : null,
    depositValue: input.requiresDeposit ? (input.depositValue ?? null) : null,
    requiresAssessment: input.requiresAssessment,
    requiresAnamnesis: input.requiresAnamnesis,
    active: input.active,
  }
}

export async function createService(input: ServiceInput): Promise<string> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1)
  if (!org) throw new Error('nenhuma organização cadastrada')

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(services)
      .values({ organizationId: org.id, ...serviceValues(input) })
      .returning({ id: services.id })
    const id = row!.id
    await writeRequirementsAndSkills(tx, id, input)
    return id
  })
}

export async function updateService(id: string, input: ServiceInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(services).set(serviceValues(input)).where(eq(services.id, id))
    await writeRequirementsAndSkills(tx, id, input)
  })
}

/** Fora de `ServiceInput` pelo mesmo motivo de `setUnitImage` — ver units.ts. */
export async function setServiceImage(id: string, imageUrl: string | null): Promise<void> {
  await db.update(services).set({ imageUrl }).where(eq(services.id, id))
}

export async function getServiceImage(id: string): Promise<string | null> {
  const [row] = await db
    .select({ imageUrl: services.imageUrl })
    .from(services)
    .where(eq(services.id, id))
    .limit(1)
  return row?.imageUrl ?? null
}

async function writeRequirementsAndSkills(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  serviceId: string,
  input: ServiceInput,
): Promise<void> {
  await tx.delete(serviceResourceRequirements).where(eq(serviceResourceRequirements.serviceId, serviceId))
  if (input.resourceTypeIds.length > 0) {
    await tx.insert(serviceResourceRequirements).values(
      input.resourceTypeIds.map((resourceTypeId) => ({ serviceId, resourceTypeId })),
    )
  }

  /* Apagar-e-reinserir só pode alcançar quem o formulário desenha. «Quem
     executa» lista apenas quem está ativo (`listAssignables`), portanto a linha
     de quem está desativado nunca voltava no `staffIds` — e o `delete` por
     serviço levava-a em QUALQUER gravação, mesmo a que só corrigia o preço. A
     Rita saía de licença e voltava sem a Coloração: a marcação online deixava
     de a oferecer, a recepção não a conseguia escolher, e nada ligava a perda
     ao dia em que se mexeu no preçário. Quem quiser mesmo tirar a habilidade de
     alguém desativado fá-lo na ficha dessa pessoa, que lista todos os serviços. */
  const ativos = await tx
    .select({ id: staffProfiles.id })
    .from(staffProfiles)
    .where(eq(staffProfiles.active, true))

  await tx.delete(staffSkills).where(
    and(
      eq(staffSkills.serviceId, serviceId),
      inArray(
        staffSkills.staffId,
        ativos.map((pessoa) => pessoa.id),
      ),
    ),
  )

  if (input.staffIds.length > 0) {
    /* `onConflictDoNothing` porque o `delete` acima já não é total: um id de
       alguém desativado, vindo por fora do formulário, bateria na unique. */
    await tx
      .insert(staffSkills)
      .values(input.staffIds.map((staffId) => ({ staffId, serviceId })))
      .onConflictDoNothing()
  }
}

export async function createCategory(name: string): Promise<string> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1)
  if (!org) throw new Error('nenhuma organização cadastrada')
  const [row] = await db
    .insert(serviceCategories)
    .values({ organizationId: org.id, name })
    .returning({ id: serviceCategories.id })
  return row!.id
}

/** Para montar o formulário: profissionais e tipos de recurso da rede. */
export async function listAssignables(): Promise<{
  staff: { id: string; name: string }[]
  resourceTypes: { id: string; name: string }[]
}> {
  const [staff, types] = await Promise.all([
    db
      .select({ id: staffProfiles.id, name: staffProfiles.displayName })
      .from(staffProfiles)
      .where(eq(staffProfiles.active, true))
      .orderBy(asc(staffProfiles.displayName)),
    db.select({ id: resourceTypes.id, name: resourceTypes.name }).from(resourceTypes).orderBy(asc(resourceTypes.name)),
  ])
  return { staff, resourceTypes: types }
}
