import 'server-only'

/**
 * Caixa por unidade. Uma sessão por vez — abrir com o caixa anterior ainda
 * aberto não é permitido, senão a gaveta física e o registro divergem.
 */

import { cashMovements, cashSessions, units } from '@studio/db'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'

export interface CashSessionView {
  id: string
  unitId: string
  status: 'open' | 'closed'
  openingAmount: number
  closingCountedAmount: number | null
  expectedAmount: number | null
  difference: number | null
  openedAt: Date
  closedAt: Date | null
  note: string | null
}

export async function getOpenSession(unitId: string): Promise<CashSessionView | null> {
  const [row] = await db
    .select()
    .from(cashSessions)
    .where(and(eq(cashSessions.unitId, unitId), eq(cashSessions.status, 'open')))
    .limit(1)
  return row ?? null
}

/**
 * De qual loja é esta sessão. As ações de caixa recebem só o `sessionId` do
 * formulário — e é aqui que ele vira unidade, para a permissão perguntar sobre
 * a loja de verdade em vez de acreditar num campo escondido.
 */
export async function unitOfSession(sessionId: string): Promise<string | null> {
  const [row] = await db
    .select({ unitId: cashSessions.unitId })
    .from(cashSessions)
    .where(eq(cashSessions.id, sessionId))
    .limit(1)
  return row?.unitId ?? null
}

export async function openSession(unitId: string, openingAmount: number): Promise<string> {
  const existing = await getOpenSession(unitId)
  if (existing) throw new Error('já existe um caixa aberto nesta unidade')

  const [row] = await db
    .insert(cashSessions)
    .values({ unitId, openingAmount, status: 'open' })
    .returning({ id: cashSessions.id })
  return row!.id
}

export interface CashMovementView {
  id: string
  type: 'payment' | 'reinforcement' | 'withdrawal'
  amount: number
  note: string | null
  occurredAt: Date
}

export async function listMovements(sessionId: string): Promise<CashMovementView[]> {
  return db
    .select({
      id: cashMovements.id,
      type: cashMovements.type,
      amount: cashMovements.amount,
      note: cashMovements.note,
      occurredAt: cashMovements.occurredAt,
    })
    .from(cashMovements)
    .where(eq(cashMovements.cashSessionId, sessionId))
    .orderBy(desc(cashMovements.occurredAt))
}

export async function addMovement(
  sessionId: string,
  type: 'reinforcement' | 'withdrawal',
  amount: number,
  note?: string,
): Promise<void> {
  if (amount <= 0) throw new Error('valor precisa ser positivo')
  await db.insert(cashMovements).values({ cashSessionId: sessionId, type, amount, note: note || null })
}

async function sumMovements(sessionId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${cashMovements.type} = 'withdrawal' then -${cashMovements.amount} else ${cashMovements.amount} end), 0)::int`,
    })
    .from(cashMovements)
    .where(eq(cashMovements.cashSessionId, sessionId))
  return row?.total ?? 0
}

export async function closeSession(
  sessionId: string,
  closingCountedAmount: number,
): Promise<{ expectedAmount: number; difference: number }> {
  const [session] = await db.select().from(cashSessions).where(eq(cashSessions.id, sessionId)).limit(1)
  if (!session) throw new Error('caixa não encontrado')
  if (session.status !== 'open') throw new Error('caixa já está fechado')

  const movementsTotal = await sumMovements(sessionId)
  const expectedAmount = session.openingAmount + movementsTotal
  const difference = closingCountedAmount - expectedAmount

  await db
    .update(cashSessions)
    .set({
      status: 'closed',
      closingCountedAmount,
      expectedAmount,
      difference,
      closedAt: new Date(),
    })
    .where(eq(cashSessions.id, sessionId))

  return { expectedAmount, difference }
}

export interface CashSessionHistoryRow extends CashSessionView {
  unitName: string
}

export async function listSessionsForUnit(unitId: string, limit = 20): Promise<CashSessionHistoryRow[]> {
  const rows = await db
    .select({
      id: cashSessions.id,
      unitId: cashSessions.unitId,
      unitName: units.name,
      status: cashSessions.status,
      openingAmount: cashSessions.openingAmount,
      closingCountedAmount: cashSessions.closingCountedAmount,
      expectedAmount: cashSessions.expectedAmount,
      difference: cashSessions.difference,
      openedAt: cashSessions.openedAt,
      closedAt: cashSessions.closedAt,
      note: cashSessions.note,
    })
    .from(cashSessions)
    .innerJoin(units, eq(units.id, cashSessions.unitId))
    .where(eq(cashSessions.unitId, unitId))
    .orderBy(desc(cashSessions.openedAt))
    .limit(limit)
  return rows
}
