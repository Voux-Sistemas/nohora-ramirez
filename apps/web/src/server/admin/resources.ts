import 'server-only'

/**
 * Cadastro de recursos: tipos (da rede, ex. "cabine") e instâncias físicas
 * (por unidade, ex. "Cabine 1", "Cabine 2"). O tipo é o que o serviço exige em
 * `service_resource_requirements`; a instância é o que a agenda de fato aloca.
 */

import { organizations, resourceTypes, resources, units } from '@studio/db'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'

export interface ResourceTypeRow {
  id: string
  name: string
  unitCount: number
}

export async function listResourceTypes(): Promise<ResourceTypeRow[]> {
  const types = await db.select().from(resourceTypes).orderBy(asc(resourceTypes.name))
  const instances = await db.select({ resourceTypeId: resources.resourceTypeId }).from(resources)
  const countByType = new Map<string, number>()
  for (const row of instances) {
    countByType.set(row.resourceTypeId, (countByType.get(row.resourceTypeId) ?? 0) + 1)
  }
  return types.map((t) => ({ id: t.id, name: t.name, unitCount: countByType.get(t.id) ?? 0 }))
}

export async function createResourceType(name: string): Promise<string> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1)
  if (!org) throw new Error('nenhuma organização cadastrada')
  const [row] = await db
    .insert(resourceTypes)
    .values({ organizationId: org.id, name })
    .returning({ id: resourceTypes.id })
  return row!.id
}

export interface ResourceRow {
  id: string
  name: string
  unitId: string
  unitName: string
  resourceTypeId: string
  resourceTypeName: string
  active: boolean
  priority: number
}

export async function listResourcesAdmin(): Promise<ResourceRow[]> {
  const rows = await db
    .select({
      id: resources.id,
      name: resources.name,
      unitId: resources.unitId,
      unitName: units.name,
      resourceTypeId: resources.resourceTypeId,
      resourceTypeName: resourceTypes.name,
      active: resources.active,
      priority: resources.priority,
    })
    .from(resources)
    .innerJoin(units, eq(units.id, resources.unitId))
    .innerJoin(resourceTypes, eq(resourceTypes.id, resources.resourceTypeId))
    .orderBy(asc(units.name), asc(resourceTypes.name), asc(resources.priority))
  return rows
}

export interface ResourceInput {
  name: string
  unitId: string
  resourceTypeId: string
  active: boolean
  priority: number
}

export async function createResource(input: ResourceInput): Promise<string> {
  const [row] = await db.insert(resources).values(input).returning({ id: resources.id })
  return row!.id
}

export async function updateResource(id: string, input: ResourceInput): Promise<void> {
  await db.update(resources).set(input).where(eq(resources.id, id))
}

/** Para montar o formulário: unidades e tipos disponíveis na rede. */
export async function listResourceAssignables(): Promise<{
  units: { id: string; name: string }[]
  resourceTypes: { id: string; name: string }[]
}> {
  const [unitRows, typeRows] = await Promise.all([
    db.select({ id: units.id, name: units.name }).from(units).orderBy(asc(units.name)),
    db.select({ id: resourceTypes.id, name: resourceTypes.name }).from(resourceTypes).orderBy(asc(resourceTypes.name)),
  ])
  return { units: unitRows, resourceTypes: typeRows }
}
