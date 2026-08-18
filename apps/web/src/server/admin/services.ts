import 'server-only'

/**
 * Cadastro de serviços: catálogo, categorias e habilidade da equipa. Preço aqui
 * é sempre o de referência da rede — exceção por unidade ou profissional é outra
 * tela (`service_pricing`), fora deste primeiro corte.
 *
 * O formulário escreve menos colunas do que a tabela tem. Folga antes e depois,
 * avaliação prévia, ficha de anamnese, sinal e recurso exigido saíram do produto
 * e não são escritos por ninguém: ficam no schema, no valor por omissão, porque
 * o motor de agenda ainda sabe lê-los e derrubá-los seria reescrever o motor
 * para apagar uma linha de formulário.
 */

import {
  organizations,
  serviceCategories,
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
  onlineBookable: boolean
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
      onlineBookable: services.onlineBookable,
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
      onlineBookable: services.onlineBookable,
      active: services.active,
      imageUrl: services.imageUrl,
    })
    .from(services)
    .leftJoin(serviceCategories, eq(serviceCategories.id, services.categoryId))
    .where(eq(services.id, id))
    .limit(1)
  const service = rows[0]
  if (!service) return null

  const skills = await db
    .select({ staffId: staffSkills.staffId })
    .from(staffSkills)
    .where(eq(staffSkills.serviceId, id))

  return { service, staffIds: skills.map((s) => s.staffId) }
}

export interface ServiceInput {
  name: string
  description?: string
  categoryId?: string
  basePrice: number
  setupMin: number
  processingMin: number
  finishMin: number
  onlineBookable: boolean
  active: boolean
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
    onlineBookable: input.onlineBookable,
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
    await writeSkills(tx, id, input)
    return id
  })
}

export async function updateService(id: string, input: ServiceInput): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(services).set(serviceValues(input)).where(eq(services.id, id))
    await writeSkills(tx, id, input)
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

async function writeSkills(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  serviceId: string,
  input: ServiceInput,
): Promise<void> {
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

/** Para montar o formulário: quem da rede pode executar o serviço. */
export async function listAssignables(): Promise<{ staff: { id: string; name: string }[] }> {
  const staff = await db
    .select({ id: staffProfiles.id, name: staffProfiles.displayName })
    .from(staffProfiles)
    .where(eq(staffProfiles.active, true))
    .orderBy(asc(staffProfiles.displayName))
  return { staff }
}
