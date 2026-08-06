import { isoDateInZone } from '@studio/core'
import { NextResponse } from 'next/server'
import {
  advanceStatus,
  cancelAppointment,
  createAppointment,
  rescheduleAppointment,
} from '@/server/scheduling/book'
import { findSlots } from '@/server/scheduling/availability'
import { deliverableServices, getUnitBySlug, loadBookingContext } from '@/server/scheduling/context'
import { findOrCreateClient } from '@/server/people/clients'
import { getAppointment } from '@/server/scheduling/queries'

/**
 * Teste de fumaça do caminho de escrita, contra o banco de desenvolvimento.
 *
 * Marca → confirma → remarca → cancela, e devolve o que aconteceu em cada passo.
 * Serve para conferir, depois de mexer no schema ou no motor, que a agenda ainda
 * grava e libera horário de verdade. Fica fora de produção.
 *
 *   GET /api/dev/smoke?unidade=centro
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'indisponível' }, { status: 404 })
  }
  const steps: unknown[] = []
  try {
    return await run(request, steps)
  } catch (error) {
    // é uma ferramenta de diagnóstico: o erro cru vale mais que uma página 500
    return NextResponse.json(
      {
        steps,
        error: String(error),
        stack: (error as Error)?.stack?.split('\n').slice(0, 8),
      },
      { status: 500 },
    )
  }
}

async function run(request: Request, steps: unknown[]) {
  const url = new URL(request.url)
  const unitSlug = url.searchParams.get('unidade') ?? 'centro'

  const unit = await getUnitBySlug(unitSlug)
  if (!unit) return NextResponse.json({ error: 'unidade não encontrada' }, { status: 404 })

  const today = isoDateInZone(new Date(), unit.timezone)
  const ctx = await loadBookingContext({ unit, fromDate: today, toDate: addDays(today, 20) })
  const catalog = deliverableServices(ctx, { onlineOnly: true })
  const service = catalog[0]
  if (!service) return NextResponse.json({ error: 'sem serviços' }, { status: 400 })

  const slots = findSlots(ctx, { cart: [{ serviceId: service.id }], onlineOnly: true, limit: 400 })
  if (slots.length < 2) {
    return NextResponse.json({ error: 'sem horários livres para testar' }, { status: 409 })
  }
  steps.push({ passo: 'disponibilidade', servico: service.name, horarios: slots.length })

  const client = await findOrCreateClient({
    phone: '+5511900000001',
    name: 'Cliente de Teste',
    preferredUnitId: unit.id,
  })

  const created = await createAppointment({
    unitSlug,
    clientId: client.clientId,
    cart: [{ serviceId: service.id }],
    start: slots[0]!.start,
    source: 'client_app',
    channel: 'online',
    clientNote: 'teste de fumaça',
  })
  steps.push({ passo: 'criar', ...created })
  if (!created.ok) return NextResponse.json({ steps }, { status: 500 })

  // o mesmo horário não pode ser vendido duas vezes
  const duplicate = await createAppointment({
    unitSlug,
    clientId: client.clientId,
    cart: [{ serviceId: service.id }],
    start: slots[0]!.start,
    source: 'client_app',
    channel: 'online',
  })
  steps.push({
    passo: 'tentar duplicar',
    bloqueado: !duplicate.ok,
    motivo: duplicate.ok ? null : duplicate.error,
  })

  await advanceStatus(created.appointmentId, 'confirmed')
  steps.push({ passo: 'confirmar', status: (await getAppointment(created.appointmentId))?.status })

  const later = slots.find((slot) => slot.start !== slots[0]!.start)!
  const moved = await rescheduleAppointment(created.appointmentId, {
    unitSlug,
    clientId: client.clientId,
    cart: [{ serviceId: service.id }],
    start: later.start,
    source: 'reception',
    channel: 'reception',
  })
  steps.push({ passo: 'remarcar', ok: moved.ok, para: moved.ok ? moved.slot.start : moved.error })

  if (moved.ok) {
    await cancelAppointment(moved.appointmentId, 'cancelled_by_client', { reason: 'teste' })
    steps.push({
      passo: 'cancelar',
      status: (await getAppointment(moved.appointmentId))?.status,
    })
  }

  // se o cancelamento liberou mesmo, o horário volta a aparecer
  const after = await loadBookingContext({ unit, fromDate: today, toDate: addDays(today, 20) })
  const reopened = findSlots(after, {
    cart: [{ serviceId: service.id }],
    onlineOnly: true,
    limit: 400,
  })
  steps.push({
    passo: 'horário devolvido',
    antes: slots.length,
    depois: reopened.length,
    liberou: reopened.some((slot) => slot.start === later.start),
  })

  return NextResponse.json({ unidade: unit.name, steps })
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}
