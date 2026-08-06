import 'server-only'

/**
 * Regras de comissão e os lançamentos gerados no fechamento de comanda.
 * Precedência da regra: profissional+serviço → profissional → serviço →
 * padrão da rede (regra sem staffId nem serviceId). Ver `resolveCommission`.
 */

import {
  commissionEntries,
  commissionRules,
  organizations,
  services,
  staffProfiles,
} from '@studio/db'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'

export interface CommissionRuleRow {
  id: string
  staffId: string | null
  staffName: string | null
  serviceId: string | null
  serviceName: string | null
  percentBps: number
}

export async function listCommissionRules(): Promise<CommissionRuleRow[]> {
  const rows = await db
    .select({
      id: commissionRules.id,
      staffId: commissionRules.staffId,
      staffName: staffProfiles.displayName,
      serviceId: commissionRules.serviceId,
      serviceName: services.name,
      percentBps: commissionRules.percentBps,
    })
    .from(commissionRules)
    .leftJoin(staffProfiles, eq(staffProfiles.id, commissionRules.staffId))
    .leftJoin(services, eq(services.id, commissionRules.serviceId))
    .orderBy(desc(commissionRules.percentBps))
  return rows
}

export interface CommissionRuleInput {
  staffId?: string
  serviceId?: string
  percentBps: number
}

export async function upsertCommissionRule(input: CommissionRuleInput): Promise<void> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1)
  if (!org) throw new Error('nenhuma organização cadastrada')

  const staffId = input.staffId || null
  const serviceId = input.serviceId || null

  const conditions = [eq(commissionRules.organizationId, org.id)]
  conditions.push(staffId ? eq(commissionRules.staffId, staffId) : isNull(commissionRules.staffId))
  conditions.push(
    serviceId ? eq(commissionRules.serviceId, serviceId) : isNull(commissionRules.serviceId),
  )

  const [existing] = await db
    .select({ id: commissionRules.id })
    .from(commissionRules)
    .where(and(...conditions))
    .limit(1)

  if (existing) {
    await db
      .update(commissionRules)
      .set({ percentBps: input.percentBps })
      .where(eq(commissionRules.id, existing.id))
  } else {
    await db.insert(commissionRules).values({
      organizationId: org.id,
      staffId,
      serviceId,
      percentBps: input.percentBps,
    })
  }
}

export async function removeCommissionRule(id: string): Promise<void> {
  await db.delete(commissionRules).where(eq(commissionRules.id, id))
}

export interface CommissionEntryRow {
  id: string
  staffId: string
  staffName: string
  serviceName: string
  baseAmount: number
  percentBps: number
  amount: number
  status: 'pending' | 'paid'
  createdAt: Date
}

export async function listCommissionEntries(filter: {
  staffId?: string
  status?: 'pending' | 'paid'
}): Promise<CommissionEntryRow[]> {
  const conditions = []
  if (filter.staffId) conditions.push(eq(commissionEntries.staffId, filter.staffId))
  if (filter.status) conditions.push(eq(commissionEntries.status, filter.status))

  const rows = await db
    .select({
      id: commissionEntries.id,
      staffId: commissionEntries.staffId,
      staffName: staffProfiles.displayName,
      serviceName: services.name,
      baseAmount: commissionEntries.baseAmount,
      percentBps: commissionEntries.percentBps,
      amount: commissionEntries.amount,
      status: commissionEntries.status,
      createdAt: commissionEntries.createdAt,
    })
    .from(commissionEntries)
    .innerJoin(staffProfiles, eq(staffProfiles.id, commissionEntries.staffId))
    .innerJoin(services, eq(services.id, commissionEntries.serviceId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(commissionEntries.createdAt))
  return rows
}

export interface CommissionSummaryRow {
  staffId: string
  staffName: string
  pendingAmount: number
  paidAmount: number
}

export async function commissionSummaryByStaff(): Promise<CommissionSummaryRow[]> {
  const entries = await db
    .select({
      staffId: commissionEntries.staffId,
      staffName: staffProfiles.displayName,
      amount: commissionEntries.amount,
      status: commissionEntries.status,
    })
    .from(commissionEntries)
    .innerJoin(staffProfiles, eq(staffProfiles.id, commissionEntries.staffId))

  const byStaff = new Map<string, CommissionSummaryRow>()
  for (const entry of entries) {
    const row = byStaff.get(entry.staffId) ?? {
      staffId: entry.staffId,
      staffName: entry.staffName,
      pendingAmount: 0,
      paidAmount: 0,
    }
    if (entry.status === 'pending') row.pendingAmount += entry.amount
    else row.paidAmount += entry.amount
    byStaff.set(entry.staffId, row)
  }
  return [...byStaff.values()].sort((a, b) => a.staffName.localeCompare(b.staffName, 'pt-BR'))
}

export async function markCommissionsPaid(staffId: string): Promise<void> {
  await db
    .update(commissionEntries)
    .set({ status: 'paid', paidAt: new Date() })
    .where(and(eq(commissionEntries.staffId, staffId), eq(commissionEntries.status, 'pending')))
}
