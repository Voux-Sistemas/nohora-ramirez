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
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { pais } from '@/lib/pais'

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
  return [...byStaff.values()].sort((a, b) => a.staffName.localeCompare(b.staffName, pais().locale))
}

export type PagamentoDeComissoes =
  | { pago: number }
  /** Ninguém pagou nada: o pendente já não é o que estava no ecrã. */
  | { divergiu: number }

/**
 * Liquida o que a dona confirmou — nem um cêntimo além.
 *
 * O `where` era `staffId + pending` e mais nada: marcava como pago tudo o que
 * estivesse pendente no instante do clique, e não o valor que ela leu no ecrã e
 * foi buscar em dinheiro. Os dois instantes são diferentes de propósito — a
 * recepção fecha comandas ao balcão exactamente enquanto o acerto é feito no
 * escritório, e cada fecho lança comissão nova. A dona entregava 340 € em mão e
 * o sistema dava 415 € por pagos; os 75 € da diferença desapareciam de
 * «Pendente» sem terem sido pagos, e nenhum ecrã lista lançamento a lançamento
 * para dar por isso.
 *
 * Por isso o valor confirmado vem no formulário e é conferido aqui dentro, com
 * as linhas trancadas: se a soma mudou, não se paga nada e quem está ao ecrã lê
 * o valor novo para confirmar de novo.
 */
export async function markCommissionsPaid(
  staffId: string,
  esperado: number,
): Promise<PagamentoDeComissoes> {
  return db.transaction(async (tx) => {
    const pendentes = await tx
      .select({ id: commissionEntries.id, amount: commissionEntries.amount })
      .from(commissionEntries)
      .where(and(eq(commissionEntries.staffId, staffId), eq(commissionEntries.status, 'pending')))
      .for('update')

    const total = pendentes.reduce((soma, linha) => soma + linha.amount, 0)
    if (total !== esperado) return { divergiu: total }
    if (pendentes.length === 0) return { pago: 0 }

    await tx
      .update(commissionEntries)
      .set({ status: 'paid', paidAt: new Date() })
      .where(
        inArray(
          commissionEntries.id,
          pendentes.map((linha) => linha.id),
        ),
      )

    return { pago: total }
  })
}
