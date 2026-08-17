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
    /* Só pode haver uma — `cash_sessions_um_aberto_por_unidade` garante-o. A
       ordem é para o caso de uma base antiga ter ficado com duas de antes do
       índice: aí a tela mostra sempre a mesma, a mais recente, em vez de
       alternar entre as duas de pedido para pedido. */
    .orderBy(desc(cashSessions.openedAt))
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

/**
 * A consulta daqui é para dar a frase certa no caso normal; quem garante a
 * regra é o índice parcial `cash_sessions_um_aberto_por_unidade`, porque entre
 * consultar e inserir há uma janela — e dois toques em "Abrir caixa" enquanto a
 * página carrega chegam lá. Sem o índice nasciam duas gavetas na mesma loja e
 * os pagamentos do dia repartiam-se entre elas.
 *
 * A recusa do banco é traduzida aqui de volta para a mesma frase: subir como
 * violação de unicidade daria ao balcão o ecrã de "alguma coisa falhou", que
 * não diz o que fazer a seguir. A frase diz.
 */
export async function openSession(unitId: string, openingAmount: number): Promise<string> {
  const existing = await getOpenSession(unitId)
  if (existing) throw new Error('já existe um caixa aberto nesta unidade')

  try {
    const [row] = await db
      .insert(cashSessions)
      .values({ unitId, openingAmount, status: 'open' })
      .returning({ id: cashSessions.id })
    return row!.id
  } catch (e) {
    if (ehCaixaJaAberto(e)) throw new Error('já existe um caixa aberto nesta unidade')
    throw e
  }
}

function ehCaixaJaAberto(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const erro = e as { code?: unknown; constraint_name?: unknown }
  if (erro.code === '23505' && erro.constraint_name === 'cash_sessions_um_aberto_por_unidade') {
    return true
  }
  return e.cause !== undefined && ehCaixaJaAberto(e.cause)
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
