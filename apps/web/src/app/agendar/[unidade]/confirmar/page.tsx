import { depositAmount, isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookingShell } from '@/components/booking/shell'
import { ConfirmForm } from '@/components/booking/confirm-form'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Photo } from '@/components/ui/photo'
import { formatMoney, formatDateLong, formatDuration, formatTime } from '@/lib/format'
import { describeSlot, planAt } from '@/server/scheduling/availability'
import { getUnitBySlug, loadBookingContext } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Confirmar' }

interface SearchParams {
  s?: string
  /** Instante escolhido, ISO. */
  t?: string
  p?: string
}

/**
 * Quarto passo: o extrato antes da assinatura.
 *
 * Tudo que foi decidido volta em uma peça só — o lugar em fotografia, a hora em
 * display, cada serviço com a profissional que vai executar e o preço na
 * direita. A cliente não deveria precisar rolar para saber quanto vai pagar nem
 * até quando pode desmarcar.
 */
export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ unidade: string }>
  searchParams: Promise<SearchParams>
}) {
  const { unidade } = await params
  const query = await searchParams

  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()

  const serviceIds = (query.s ?? '').split(',').filter(Boolean)
  const start = query.t ? new Date(query.t) : null
  if (serviceIds.length === 0 || !start || Number.isNaN(start.getTime())) {
    redirect(`/agendar/${unidade}`)
  }

  const date = isoDateInZone(start, unit.timezone)
  const ctx = await loadBookingContext({ unit, fromDate: date, toDate: date })

  const staffId = query.p
  const cart = serviceIds.map((id) => ({ serviceId: id, ...(staffId ? { staffId } : {}) }))
  const plan = planAt(ctx, { cart, onlineOnly: true }, start)

  const backToSlots = `/agendar/${unidade}/horarios?s=${serviceIds.join(',')}${staffId ? `&p=${staffId}` : ''}&d=${date}`

  if (!plan) {
    return (
      <BookingShell step={4} title="Este horário já não está livre" back={backToSlots}>
        <p className="text-body measure">
          Alguém marcou antes ou a agenda mudou nos últimos minutos. Os seus serviços continuam
          escolhidos — é só escolher outro horário.
        </p>
        <Link href={backToSlots as never} className="mt-7 inline-block">
          <Button size="xl">Ver horários de novo</Button>
        </Link>
      </BookingShell>
    )
  }

  const slot = describeSlot(ctx, plan)
  const deposit = plan.items.reduce((sum, item, index) => {
    const service = ctx.services.get(item.serviceId)
    return sum + depositAmount(slot.items[index]!.price, service?.deposit ?? null)
  }, 0)

  return (
    <BookingShell
      step={4}
      title="Confira se está tudo certo"
      // A data está em corpo grande dentro da placa; repetir aqui só gastava
      // uma linha. O subtítulo carrega o que ainda não apareceu nesta tela.
      subtitle={slot.items.map((item) => item.serviceName).join(' + ')}
      back={backToSlots}
      backLabel="Mudar o horário"
      railFirst
      rail={
        <article className="plate overflow-hidden">
          <div className="relative">
            <Photo
              src={unit.imageUrl}
              alt=""
              name={unit.name}
              // Primeira coisa acima da dobra nesta tela, e a maior: sem
              // `priority` ela entra na fila atrás dos chunks e é justamente
              // ela que marca o LCP.
              priority
              sizes="(min-width: 1024px) 22rem, 100vw"
              className="aspect-[16/7]"
            />
            <div className="scrim-photo pointer-events-none absolute inset-0" aria-hidden />
            {/*
              No celular a foto é uma faixa 16/7 estreita e o nome em 28px de
              didone encostava nas duas bordas. Um passo abaixo até `sm` devolve a
              margem sem tirar a presença.
            */}
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <p className="display text-[1.375rem] leading-tight text-(--on-ink) sm:text-[1.75rem]">
                {unit.name}
              </p>
              {unit.addressLine ? (
                <p className="mt-1 text-[0.8125rem] text-(--on-ink-muted) sm:text-sm">
                  {unit.addressLine}
                  {unit.district ? ` · ${unit.district}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <p className="display tnum text-[2rem] leading-none">
              {formatTime(slot.start, unit.timezone)}
              <span className="text-(--text-muted)"> – </span>
              {formatTime(slot.end, unit.timezone)}
            </p>
            <p className="text-muted mt-2 text-sm">
              {formatDateLong(date)} · {formatDuration(slot.totalDurationMin)} no salão
            </p>

            <div className="rule-bronze mt-5" aria-hidden />

            <ul className="mt-5 space-y-4">
              {slot.items.map((item) => (
                <li key={`${item.serviceId}-${item.start}`} className="flex items-center gap-3">
                  <span className="tnum text-muted w-12 shrink-0 text-sm">
                    {formatTime(item.start, unit.timezone)}
                  </span>
                  <Avatar
                    name={item.staffName}
                    color={ctx.staffInfo.get(item.staffId)?.color ?? null}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.serviceName}</span>
                    <span className="text-muted block text-sm">com {item.staffName}</span>
                  </span>
                  <span className="tnum shrink-0 text-sm">{formatMoney(item.price)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-baseline justify-between border-t border-(--border-subtle) pt-4">
              <span className="font-medium">Total</span>
              <span className="tnum display text-[1.75rem] leading-none">
                {formatMoney(slot.totalPrice)}
              </span>
            </div>

            {deposit > 0 ? (
              <p className="text-body mt-3 text-sm">
                Este procedimento pede sinal de{' '}
                <span className="tnum font-medium">{formatMoney(deposit)}</span>. A receção envia
                o link de pagamento pelo WhatsApp.
              </p>
            ) : null}

            <p className="text-muted mt-3 text-sm">
              Cancelamento sem custo até {unit.settings.cancellationWindowHours}h antes. O restante
              é pago no salão.
            </p>
          </div>
        </article>
      }
    >
      <ConfirmForm
        unidade={unidade}
        servicos={serviceIds.join(',')}
        inicio={slot.start}
        {...(staffId ? { profissional: staffId } : {})}
      />
    </BookingShell>
  )
}
