import { priceRange, resolvePrice } from '@studio/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BookingShell } from '@/components/booking/shell'
import { ServicePicker, type PickableService } from '@/components/booking/service-picker'
import { UnitContextCard } from '@/components/booking/unit-context-card'
import { dicionario, interpola } from '@/i18n'
import { lerIdioma } from '@/lib/idioma'
import { todayInUnit } from '@/server/scheduling/availability'
import {
  deliverableServices,
  getUnitBySlug,
  loadBookingContext,
  staffForCart,
} from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unidade: string }>
}): Promise<Metadata> {
  const [unit, idioma] = await Promise.all([getUnitBySlug((await params).unidade), lerIdioma()])
  const dic = dicionario(idioma)
  return {
    title: unit ? interpola(dic.meta.marcarEm, { loja: unit.name }) : dic.meta.marcar,
  }
}

export default async function EscolherServicosPage({
  params,
  searchParams,
}: {
  params: Promise<{ unidade: string }>
  /** `s` = os serviços que já estavam escolhidos, quando se chega aqui de volta. */
  searchParams: Promise<{ s?: string }>
}) {
  const { unidade } = await params
  const { s } = await searchParams
  const [unit, idioma] = await Promise.all([getUnitBySlug(unidade), lerIdioma()])
  if (!unit) notFound()

  const dic = dicionario(idioma)

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
      categoryName:
        (service.categoryId && ctx.categories.get(service.categoryId)) || dic.agendar.servicos.outros,
      imageUrl: service.imageUrl,
    }
  })

  /* Filtrado contra o cardápio desta casa: um id que veio do endereço e já não
     se entrega aqui não pode ficar seleccionado num item que não existe — e a
     cliente ficaria com um total que não bate com o que vê. */
  const disponiveis = new Set(services.map((service) => service.id))
  const escolhidos = (s ?? '').split(',').filter((id) => disponiveis.has(id))

  return (
    <BookingShell
      step={2}
      idioma={idioma}
      title={dic.agendar.servicos.titulo}
      subtitle={`${unit.name}${unit.district ? ` · ${unit.district}` : ''}`}
      back="/agendar"
      rail={<UnitContextCard unit={unit} />}
    >
      {services.length === 0 ? (
        <p className="text-muted">{dic.agendar.servicos.semServicos}</p>
      ) : (
        <ServicePicker
          nextHref={`/agendar/${unit.slug}/horarios`}
          services={services}
          escolhidos={escolhidos}
          textos={dic.agendar.servicos}
          comum={dic.comum}
        />
      )}
    </BookingShell>
  )
}

