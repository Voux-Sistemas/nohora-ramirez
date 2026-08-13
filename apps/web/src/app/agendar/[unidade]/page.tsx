import { priceRange, resolvePrice } from '@studio/core'
import { notFound } from 'next/navigation'
import { BookingShell } from '@/components/booking/shell'
import { ServicePicker, type PickableService } from '@/components/booking/service-picker'
import { UnitContextCard } from '@/components/booking/unit-context-card'
import { formatMoney } from '@/lib/format'
import { todayInUnit } from '@/server/scheduling/availability'
import {
  deliverableServices,
  getUnitBySlug,
  loadBookingContext,
  staffForCart,
} from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ unidade: string }> }) {
  const unit = await getUnitBySlug((await params).unidade)
  return { title: unit ? `Agendar · ${unit.name}` : 'Agendar' }
}

export default async function EscolherServicosPage({
  params,
}: {
  params: Promise<{ unidade: string }>
}) {
  const { unidade } = await params
  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()

  const today = todayInUnit(unit)
  const ctx = await loadBookingContext({ unit, fromDate: today, toDate: today })
  const catalog = deliverableServices(ctx, { onlineOnly: true })

  const services: PickableService[] = catalog.map((service) => {
    const priceCtx = {
      serviceId: service.id,
      unitId: unit.id,
      basePrice: service.basePrice,
      baseDurationMin: service.clientDurationMin,
    }
    const { durationMin } = resolvePrice(ctx.priceOverrides, priceCtx)

    /*
      A profissional ainda não foi escolhida, e é ela que fecha o preço — a
      sênior cobra mais que a júnior pelo mesmo corte. Então aqui não cabe um
      número exato: cabe o piso da unidade, e o aviso de que é piso. A tela de
      confirmação mostra o valor definitivo, e ele nunca vem abaixo deste.
    */
    const range = priceRange(
      ctx.priceOverrides,
      priceCtx,
      staffForCart(ctx, [service.id], { onlineOnly: true }).map((person) => person.id),
    )

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: range.min,
      priceVaries: range.varies,
      durationMin,
      categoryName: (service.categoryId && ctx.categories.get(service.categoryId)) || 'Outros',
      requiresAnamnesis: service.requiresAnamnesis,
      depositLabel: depositLabel(service.deposit, range.min),
      imageUrl: service.imageUrl,
    }
  })

  return (
    <BookingShell
      step={2}
      title="O que você vai fazer hoje?"
      subtitle={`${unit.name}${unit.district ? ` · ${unit.district}` : ''}`}
      back="/agendar"
      rail={<UnitContextCard unit={unit} />}
    >
      {services.length === 0 ? (
        <p className="text-muted">
          Esta unidade ainda não tem serviços liberados para agendamento online. Ligue para a
          recepção.
        </p>
      ) : (
        <ServicePicker nextHref={`/agendar/${unit.slug}/horarios`} services={services} />
      )}
    </BookingShell>
  )
}

function depositLabel(
  deposit: { type: 'percent'; bps: number } | { type: 'fixed'; cents: number } | null,
  price: number,
): string | null {
  if (!deposit) return null
  if (deposit.type === 'fixed') return formatMoney(deposit.cents)
  return `${deposit.bps / 100}% (${formatMoney(Math.round((price * deposit.bps) / 10_000))})`
}
