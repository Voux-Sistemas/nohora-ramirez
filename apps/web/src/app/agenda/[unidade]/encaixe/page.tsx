import { addDaysInZone, priceRange, resolvePrice } from '@studio/core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EncaixeForm } from '@/components/agenda/encaixe-form'
import { ServicePicker, type PickableService } from '@/components/booking/service-picker'
import { buttonVariants } from '@/components/ui/button'
import { formatBRL, formatDateLong, formatDuration, formatPhone, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { searchClients } from '@/server/people/clients'
import { findSlots, planAt, todayInUnit } from '@/server/scheduling/availability'
import {
  deliverableServices,
  getUnitBySlug,
  loadBookingContext,
  staffForCart,
} from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * Encaixe: marcar pela recepção, com a cliente no balcão ou no telefone.
 *
 * Um caminho só, guiado por parâmetros de URL — serviços, horário, cliente. É
 * feio de ler na barra de endereço e ótimo na prática: a recepcionista volta um
 * passo com o botão do navegador e não perde nada, e o link do atendimento pode
 * ser mandado pra outra pessoa continuar.
 *
 * Aqui NÃO vale `onlineOnly` nem antecedência mínima: quem está na frente da
 * cliente marca o que precisar, na hora que precisar. Quem decide isso é o
 * canal `reception` lá em `book.ts`.
 */
export default async function EncaixePage({
  params,
  searchParams,
}: {
  params: Promise<{ unidade: string }>
  searchParams: Promise<{
    d?: string
    s?: string
    p?: string
    t?: string
    q?: string
    nome?: string
    tel?: string
  }>
}) {
  const { unidade } = await params
  const query = await searchParams

  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()

  const date = isValidDate(query.d) ? query.d : todayInUnit(unit)
  const serviceIds = (query.s ?? '').split(',').filter(Boolean)
  const staffId = query.p || undefined
  const base = `/agenda/${unit.slug}/encaixe?d=${date}`

  const ctx = await loadBookingContext({ unit, fromDate: date, toDate: date })

  // ─── passo 1: serviços ────────────────────────────────────────────────────
  if (serviceIds.length === 0) {
    const services: PickableService[] = deliverableServices(ctx).map((service) => {
      const priceCtx = {
        serviceId: service.id,
        unitId: unit.id,
        basePrice: service.basePrice,
        baseDurationMin: service.clientDurationMin,
      }
      const { durationMin } = resolvePrice(ctx.priceOverrides, priceCtx)
      // A recepção também escolhe o serviço antes da profissional: mesmo piso,
      // mesmo aviso. Ela precisa poder responder "a partir de quanto" no balcão.
      const range = priceRange(
        ctx.priceOverrides,
        priceCtx,
        staffForCart(ctx, [service.id]).map((person) => person.id),
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
        depositLabel: null,
        imageUrl: service.imageUrl,
      }
    })

    return (
      <Shell unit={unit.name} date={date} slug={unit.slug} title="O que ela vai fazer?">
        <ServicePicker nextHref={base} services={services} ctaLabel="Ver horários" />
      </Shell>
    )
  }

  const cart = serviceIds.map((serviceId) => ({
    serviceId,
    ...(staffId ? { staffId } : {}),
  }))

  // ─── passo 3: confirmar ───────────────────────────────────────────────────
  if (query.t) {
    const start = new Date(query.t)
    const plan = Number.isNaN(start.getTime())
      ? null
      : planAt(ctx, { cart, ignoreLeadRules: true }, start)

    if (!plan) {
      return (
        <Shell unit={unit.name} date={date} slug={unit.slug} title="Horário ocupado">
          <p className="text-muted">
            Esse horário não está mais livre. Escolha outro.
          </p>
          <Link
            href={href(`${base}&s=${serviceIds.join(',')}`)}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}
          >
            Voltar aos horários
          </Link>
        </Shell>
      )
    }

    const matches = query.q ? await searchClients(query.q, 6) : []
    const total = plan.items.reduce((sum, item) => {
      const service = ctx.services.get(item.serviceId)
      const { price } = resolvePrice(ctx.priceOverrides, {
        serviceId: item.serviceId,
        unitId: unit.id,
        staffId: item.staffId,
        basePrice: service?.basePrice ?? 0,
        baseDurationMin: service?.clientDurationMin ?? 0,
      })
      return sum + price
    }, 0)

    const keep = `${base}&s=${serviceIds.join(',')}${staffId ? `&p=${staffId}` : ''}&t=${encodeURIComponent(query.t)}`

    return (
      <Shell
        unit={unit.name}
        date={date}
        slug={unit.slug}
        title={`${formatTime(plan.start, unit.timezone)} · ${formatDuration(plan.totalDurationMin)}`}
        back={`${base}&s=${serviceIds.join(',')}${staffId ? `&p=${staffId}` : ''}`}
      >
        <ul className="surface rounded-card mb-5 divide-y divide-(--border-subtle) text-sm">
          {plan.items.map((item) => (
            <li key={`${item.serviceId}-${item.start.getTime()}`} className="flex justify-between gap-3 px-4 py-2.5">
              <span>
                <span className="tnum text-muted mr-2">{formatTime(item.start, unit.timezone)}</span>
                {ctx.services.get(item.serviceId)?.name ?? 'Serviço'}
                <span className="text-muted"> · {ctx.staffInfo.get(item.staffId)?.name}</span>
              </span>
            </li>
          ))}
          <li className="flex justify-between px-4 py-2.5 font-medium">
            <span>Total</span>
            <span className="tnum">{formatBRL(total)}</span>
          </li>
        </ul>

        {/* buscar cliente já cadastrada evita telefone duplicado e perde histórico */}
        <form action={`/agenda/${unit.slug}/encaixe`} className="mb-5 flex gap-2">
          <input type="hidden" name="d" value={date} />
          <input type="hidden" name="s" value={serviceIds.join(',')} />
          {staffId ? <input type="hidden" name="p" value={staffId} /> : null}
          <input type="hidden" name="t" value={query.t} />
          <input
            name="q"
            defaultValue={query.q ?? ''}
            placeholder="buscar cliente por nome ou telefone"
            className="field h-11"
          />
          <button className={cn(buttonVariants({ variant: 'outline' }))}>Buscar</button>
        </form>

        {matches.length > 0 ? (
          <ul className="surface rounded-card mb-5 divide-y divide-(--border-subtle) text-sm">
            {matches.map((match) => (
              <li key={match.clientId}>
                <Link
                  href={href(`${keep}&nome=${encodeURIComponent(match.name)}&tel=${encodeURIComponent(match.phone)}`)}
                  className="flex justify-between gap-3 px-4 py-2.5 hover:bg-(--surface-sunken)"
                >
                  <span>{match.name}</span>
                  <span className="text-muted tnum">{formatPhone(match.phone)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        <EncaixeForm
          unidade={unit.slug}
          data={date}
          servicos={serviceIds.join(',')}
          inicio={plan.start.toISOString()}
          {...(staffId ? { profissional: staffId } : {})}
          {...(query.nome ? { nome: query.nome } : {})}
          {...(query.tel ? { telefone: query.tel } : {})}
        />
      </Shell>
    )
  }

  // ─── passo 2: horário ─────────────────────────────────────────────────────
  const slots = findSlots(ctx, { cart, ignoreLeadRules: true, limit: 400 })
  const team = staffForCart(ctx, serviceIds)
  const keepServices = `${base}&s=${serviceIds.join(',')}`

  return (
    <Shell
      unit={unit.name}
      date={date}
      slug={unit.slug}
      title="Quando?"
      back={`/agenda/${unit.slug}/encaixe?d=${date}`}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <Chip to={keepServices} active={!staffId}>
          Qualquer profissional
        </Chip>
        {team.map((person) => (
          <Chip key={person.id} to={`${keepServices}&p=${person.id}`} active={staffId === person.id}>
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: person.color }}
            />
            {person.name}
          </Chip>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <Link
          href={href(`/agenda/${unit.slug}/encaixe?d=${addDaysInZone(date, -1)}&s=${serviceIds.join(',')}${staffId ? `&p=${staffId}` : ''}`)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ← dia anterior
        </Link>
        <Link
          href={href(`/agenda/${unit.slug}/encaixe?d=${addDaysInZone(date, 1)}&s=${serviceIds.join(',')}${staffId ? `&p=${staffId}` : ''}`)}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          próximo dia →
        </Link>
      </div>

      {slots.length === 0 ? (
        <p className="text-muted">Nenhum horário livre neste dia com essa combinação.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {slots.map((slot) => (
            <li key={slot.start}>
              {/* A mesma pastilha de horário da tela da cliente e da
                  remarcação: uma hora livre tem sempre a mesma cara. */}
              <Link
                href={href(`${keepServices}${staffId ? `&p=${staffId}` : ''}&t=${encodeURIComponent(slot.start)}`)}
                className="tnum rounded-plate flex h-14 items-center justify-center border border-(--border-subtle) bg-(--surface-raised) text-[1.0625rem] font-medium transition-[border-color,background-color,transform] duration-150 hover:border-(--surface-invert) hover:bg-(--surface-sunken) active:translate-y-px"
              >
                {formatTime(slot.start, unit.timezone)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

function Shell({
  unit,
  date,
  slug,
  title,
  back,
  children,
}: {
  unit: string
  date: string
  slug: string
  title: string
  back?: string
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 pb-28 sm:px-8">
      <Link href={href(back ?? `/agenda/${slug}?d=${date}`)} className="text-muted text-sm hover:underline">
        ← voltar
      </Link>
      {/*
        Sem sobrolho dourado em caixa alta: unidade e data cabem na linha de
        apoio, e o título fica sozinho no alto, que é onde o olho pousa.
      */}
      <h1 className="display mt-3 text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">
        {title}
      </h1>
      <p className="text-muted mb-6 text-sm">
        Encaixe · {unit} · {formatDateLong(date)}
      </p>
      {children}
    </main>
  )
}

function Chip({
  to,
  active,
  children,
}: {
  to: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href(to)}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
        active
          ? 'border-(--surface-invert) bg-(--surface-invert) text-(--on-invert)'
          : 'border-(--border-subtle) hover:bg-(--surface-sunken)',
      )}
    >
      {children}
    </Link>
  )
}

function isValidDate(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
