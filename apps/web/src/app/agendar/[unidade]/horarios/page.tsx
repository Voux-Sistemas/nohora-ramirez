import { addDaysInZone, isoDateInZone, isoTimeInZone, priceRange } from '@studio/core'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { BookingShell } from '@/components/booking/shell'
import { UnitContextCard } from '@/components/booking/unit-context-card'
import { Avatar } from '@/components/ui/avatar'
import { buttonVariants } from '@/components/ui/button'
import {
  formatMoney,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatPhone,
  formatTime,
  formatWeekdayShort,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { findSlots, type SlotOption } from '@/server/scheduling/availability'
import { getUnitBySlug, loadBookingContext, staffForCart } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Escolher horário' }

/** Duas semanas de cada vez: além disso a agenda ainda muda muito. */
const HORIZON_DAYS = 14

/**
 * Três turnos, não catorze botões iguais numa grelha corrida. O limite de
 * cada um é o fim do turno (exclusivo): quem entra às 12:00 já é da tarde.
 */
const PERIODOS = [
  { id: 'manha', label: 'Manhã', ateMin: 12 * 60 },
  { id: 'tarde', label: 'Tarde', ateMin: 18 * 60 },
  { id: 'noite', label: 'Noite', ateMin: 24 * 60 },
] as const

function periodoDoHorario(startIso: string, timeZone: string): (typeof PERIODOS)[number] {
  const [h, m] = isoTimeInZone(new Date(startIso), timeZone).split(':').map(Number)
  const minutosDoDia = h! * 60 + m!
  return PERIODOS.find((periodo) => minutosDoDia < periodo.ateMin) ?? PERIODOS[PERIODOS.length - 1]!
}

interface SearchParams {
  /** Serviços escolhidos, separados por vírgula. */
  s?: string
  /** Data selecionada, `YYYY-MM-DD`. */
  d?: string
  /** Profissional preferido. */
  p?: string
}

/**
 * Terceiro passo, e o coração da tese: escolher uma pessoa e uma hora.
 *
 * A profissional vem antes do dia porque é assim que a decisão acontece de
 * verdade — quem já tem a Juliana não troca de mão por causa de um horário, e
 * quem não tem preferência passa reto em um toque. Por isso a equipe aparece
 * como pessoas (rosto, nome, cor da agenda), não como filtro em pílula.
 */
export default async function EscolherHorarioPage({
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
  if (serviceIds.length === 0) redirect(`/agendar/${unidade}`)

  const today = isoDateInZone(new Date(), unit.timezone)
  const lastDay = addDaysInZone(today, HORIZON_DAYS - 1)

  const ctx = await loadBookingContext({ unit, fromDate: today, toDate: lastDay })
  const chosen = serviceIds
    .map((id) => ctx.services.get(id))
    .filter((service): service is NonNullable<typeof service> => service !== undefined)
  if (chosen.length === 0) redirect(`/agendar/${unidade}`)

  const team = staffForCart(ctx, serviceIds, { onlineOnly: true })
  const staffId = query.p && team.some((person) => person.id === query.p) ? query.p : undefined

  /*
    Mesmo piso que o passo anterior mostrou, calculado do mesmo jeito — soma do
    mínimo de cada serviço entre quem pode executá-lo. Não é o preço do horário
    escolhido (esse muda com o dia e a profissional); é o "a partir de" que
    acompanha a cliente enquanto ela ainda está decidindo quando vir.
  */
  const totalDurationMin = chosen.reduce((sum, service) => sum + service.clientDurationMin, 0)
  const priceFloor = chosen.reduce((sum, service) => {
    const range = priceRange(
      ctx.priceOverrides,
      {
        serviceId: service.id,
        unitId: unit.id,
        basePrice: service.basePrice,
        baseDurationMin: service.clientDurationMin,
      },
      staffForCart(ctx, [service.id], { onlineOnly: true }).map((person) => person.id),
    )
    return { min: sum.min + range.min, varies: sum.varies || range.varies }
  }, { min: 0, varies: false })

  const slots = findSlots(ctx, {
    cart: serviceIds.map((id) => ({ serviceId: id, ...(staffId ? { staffId } : {}) })),
    onlineOnly: true,
    limit: 1200,
  })

  const byDate = new Map<string, SlotOption[]>()
  for (const slot of slots) {
    const date = isoDateInZone(new Date(slot.start), unit.timezone)
    const list = byDate.get(date) ?? []
    list.push(slot)
    byDate.set(date, list)
  }

  const days = Array.from({ length: HORIZON_DAYS }, (_, index) => addDaysInZone(today, index))
  const selected =
    query.d && byDate.has(query.d) ? query.d : (days.find((date) => byDate.has(date)) ?? today)
  const daySlots = byDate.get(selected) ?? []

  const slotsByPeriodo = new Map<string, SlotOption[]>()
  for (const slot of daySlots) {
    const periodo = periodoDoHorario(slot.start, unit.timezone)
    const list = slotsByPeriodo.get(periodo.id) ?? []
    list.push(slot)
    slotsByPeriodo.set(periodo.id, list)
  }

  const base = `/agendar/${unidade}/horarios?s=${serviceIds.join(',')}`
  const withStaff = (id?: string) => `${base}${id ? `&p=${id}` : ''}&d=${selected}`
  const withDate = (date: string) => `${base}${staffId ? `&p=${staffId}` : ''}&d=${date}`

  /**
   * Nada livre em duas semanas inteiras — não é "este dia está cheio", é outro
   * estado. Acontece de verdade: combinação longa com uma única profissional
   * habilitada, que é justamente o caso das mechas com a colorista sênior.
   * Aqui o seletor de dia não tem o que selecionar, então ele sai da tela e a
   * cliente recebe saídas reais em vez de "tente outra data".
   */
  const horizonEmpty = byDate.size === 0

  return (
    <BookingShell
      step={3}
      title="Com quem, e quando?"
      subtitle={chosen.map((service) => service.name).join(' + ')}
      back={`/agendar/${unidade}`}
      backLabel="Mudar os serviços"
      rail={
        <div className="flex flex-col gap-6">
          <UnitContextCard unit={unit} />
          <div className="plate p-5">
            <p className="label-caps text-muted">Serviços escolhidos</p>
            <ul className="mt-3 space-y-2 text-sm">
              {chosen.map((service) => (
                <li key={service.id}>{service.name}</li>
              ))}
            </ul>
            <p className="text-muted tnum mt-4 flex items-baseline justify-between border-t border-(--border-subtle) pt-3 text-sm">
              <span>{formatDuration(totalDurationMin)} no salão</span>
              <span className="text-(--text-strong)">
                {priceFloor.varies ? 'a partir de ' : ''}
                {formatMoney(priceFloor.min)}
              </span>
            </p>
          </div>
        </div>
      }
      /*
        Na coluna do rail, este resumo só existe a partir de `lg` — no
        telemóvel ele nasce depois de tudo, atrás do calendário e da lista de
        horários. O rodapé fixo é a mesma informação, sempre à vista, sem
        depender de rolar até o fim.
      */
      footer={
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="min-w-0 truncate">
            {chosen.length} {chosen.length === 1 ? 'serviço' : 'serviços'} ·{' '}
            {formatDuration(totalDurationMin)}
          </span>
          <span className="tnum shrink-0 font-medium">
            {priceFloor.varies ? 'a partir de ' : ''}
            {formatMoney(priceFloor.min)}
          </span>
        </div>
      }
    >
      <section aria-labelledby="profissional">
        <SectionHead id="profissional">Profissional</SectionHead>

        <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <li className="shrink-0">
            <PersonOption href={withStaff(undefined)} active={!staffId} name="Sem preferência">
              <span
                aria-hidden
                className={cn(
                  'grid h-12 w-12 place-items-center rounded-full ring-1 ring-(--border-subtle) ring-inset',
                  'bg-(--surface-sunken) text-lg leading-none font-semibold text-(--text-muted)',
                )}
              >
                ·
              </span>
            </PersonOption>
          </li>

          {team.map((person) => (
            <li key={person.id} className="shrink-0">
              <PersonOption
                href={withStaff(person.id)}
                active={staffId === person.id}
                name={firstName(person.name)}
              >
                <Avatar name={person.name} color={person.color} size="md" />
              </PersonOption>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dia" className={cn('mt-10', horizonEmpty && 'hidden')}>
        <SectionHead id="dia">Dia</SectionHead>

        {/*
          Grade, não fita rolável. As duas semanas cabem inteiras, então a fita
          só escondia coisa: o dia selecionado podia estar fora da janela de
          rolagem e a cliente via a lista de horários de um dia que ela não
          conseguia enxergar marcado.
        */}
        <ul className="grid grid-cols-5 gap-2 sm:grid-cols-7">
          {days.map((date) => {
            const count = byDate.get(date)?.length ?? 0
            const isSelected = date === selected
            const empty = count === 0

            const face = (
              <>
                <span
                  className={cn(
                    'text-[0.625rem] font-semibold tracking-[0.1em] uppercase',
                    isSelected ? 'text-(--on-invert-muted)' : 'text-(--text-muted)',
                  )}
                >
                  {formatWeekdayShort(date)}
                </span>
                <span className="tnum text-[0.9375rem] font-semibold">
                  {formatDateShort(date)}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'mt-0.5 h-px w-4 transition-colors',
                    empty ? 'bg-transparent' : isSelected ? 'bg-(--accent)' : 'bg-(--border-strong)',
                  )}
                />
                <span className="sr-only">
                  {empty ? 'sem horários' : `${count} horários livres`}
                </span>
              </>
            )

            const shape =
              'flex flex-col items-center gap-0.5 rounded-plate border px-1 py-2.5 text-center'

            // Dia sem horário não é link: clicar levava para uma URL que o
            // servidor descartava em silêncio e devolvia outro dia selecionado.
            return (
              <li key={date}>
                {empty ? (
                  <span className={cn(shape, 'border-(--border-subtle) opacity-40')}>{face}</span>
                ) : (
                  <Link
                    href={withDate(date) as never}
                    aria-current={isSelected ? 'date' : undefined}
                    className={cn(
                      shape,
                      'transition-colors duration-150',
                      isSelected
                        ? 'border-(--surface-invert) bg-(--surface-invert) text-(--on-invert)'
                        : 'border-(--border-subtle) bg-(--surface-raised) hover:border-(--border-strong)',
                    )}
                  >
                    {face}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="horarios" className="mt-10">
        <SectionHead id="horarios">
          {horizonEmpty ? 'Agenda cheia' : formatDateLong(selected)}
        </SectionHead>

        {horizonEmpty ? (
          <div className="rounded-plate border border-dashed border-(--border-strong) px-5 py-9 text-center">
            <p className="text-body measure mx-auto">
              {staffId
                ? 'Esta profissional não tem nenhum horário livre nas próximas duas semanas para esta combinação.'
                : 'Não há horário livre nas próximas duas semanas para esta combinação de serviços. É longa e poucas profissionais a executam.'}
            </p>

            {/* Saídas de verdade, na ordem em que resolvem: soltar a
                preferência, encurtar a combinação, mudar de casa, ligar. */}
            <div className="mt-6 flex flex-col items-center gap-3">
              {staffId ? (
                <Link
                  href={withStaff(undefined) as never}
                  className={buttonVariants({ variant: 'outline', size: 'md' })}
                >
                  Ver a agenda da equipa inteira
                </Link>
              ) : (
                <Link
                  href={`/agendar/${unidade}` as never}
                  className={buttonVariants({ variant: 'outline', size: 'md' })}
                >
                  Escolher menos serviços
                </Link>
              )}

              <p className="text-muted text-sm">
                <Link href={'/agendar' as never} className="underline underline-offset-4">
                  Ver outra unidade
                </Link>
                {unit.phone ? (
                  <>
                    {' · ou fale com a receção: '}
                    <a
                      href={`tel:${unit.phone}`}
                      className="tnum whitespace-nowrap underline underline-offset-4"
                    >
                      {formatPhone(unit.phone)}
                    </a>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        ) : daySlots.length === 0 ? (
          <div className="rounded-plate border border-dashed border-(--border-strong) px-5 py-8 text-center">
            <p className="text-body measure mx-auto">
              Nenhum horário livre neste dia.
              {staffId
                ? ' Escolha outra data acima, ou tire a preferência de profissional para ver a agenda da equipa inteira.'
                : ' Escolha uma das datas marcadas acima.'}
            </p>
            {staffId ? (
              <Link
                href={withStaff(undefined) as never}
                className="mt-4 inline-block text-sm font-medium text-(--accent-ink) underline underline-offset-4"
              >
                Ver todos os profissionais
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            {/*
              Três turnos com régua de bronze, não uma grelha corrida de trinta
              botões iguais — é o momento mais denso do fluxo, e o que decide
              ali é o período do dia antes da hora exata. Turno sem horário
              nenhum some da tela: dizer "Manhã" sobre uma lista vazia não
              ajuda ninguém a escolher.
            */}
            <div className="space-y-8">
              {PERIODOS.map((periodo) => {
                const periodoSlots = slotsByPeriodo.get(periodo.id)
                if (!periodoSlots || periodoSlots.length === 0) return null

                return (
                  <div key={periodo.id}>
                    <div className="mb-3 flex items-baseline gap-3">
                      <h3 className="label-caps text-muted">{periodo.label}</h3>
                      <span className="rule-bronze min-w-0 flex-1" aria-hidden />
                    </div>

                    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {periodoSlots.map((slot) => {
                        /*
                          A legenda embaixo da hora só existe se disser algo que
                          a cliente ainda não sabe. Com profissional já
                          escolhida ela não diz nada; e "2 serviços" repetido em
                          catorze botões idênticos é ruído — o que decide é QUEM
                          atende, que é o que aparece quando a escolha ainda
                          está em aberto.
                        */
                        const people = [...new Set(slot.items.map((item) => item.staffName))]
                        const caption = staffId
                          ? null
                          : people.length === 1
                            ? firstName(people[0]!)
                            : `${people.length} profissionais`

                        return (
                          <li key={slot.start}>
                            <Link
                              href={
                                `/agendar/${unidade}/confirmar?s=${serviceIds.join(',')}&t=${encodeURIComponent(slot.start)}${staffId ? `&p=${staffId}` : ''}` as never
                              }
                              className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-plate border border-(--border-subtle) bg-(--surface-raised) transition-[border-color,background-color,transform] duration-150 hover:border-(--surface-invert) hover:bg-(--surface-sunken) active:translate-y-px"
                            >
                              <span className="tnum text-[1.0625rem] font-medium">
                                {formatTime(slot.start, unit.timezone)}
                              </span>
                              {caption ? (
                                <span className="text-muted text-[0.6875rem]">{caption}</span>
                              ) : null}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
            </div>

            <p className="text-muted tnum mt-6 border-t border-(--border-subtle) pt-4 text-sm">
              {formatDuration(daySlots[0]!.totalDurationMin)} no salão ·{' '}
              {formatMoney(daySlots[0]!.totalPrice)}
              <span className="text-muted"> · pagamento no dia</span>
            </p>
          </>
        )}
      </section>
    </BookingShell>
  )
}

/** Título de seção do passo: nome à esquerda, régua de bronze fechando a linha. */
function SectionHead({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline gap-4">
      <h2 id={id} className="shrink-0 text-sm font-semibold">
        {children}
      </h2>
      <span className="rule-bronze min-w-0 flex-1" aria-hidden />
    </div>
  )
}

function PersonOption({
  href,
  active,
  name,
  children,
}: {
  href: string
  active: boolean
  name: string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href as never}
      aria-current={active ? 'true' : undefined}
      className="flex w-[5.25rem] flex-col items-center gap-2 rounded-plate py-1 text-center"
    >
      <span
        className={cn(
          'rounded-full transition-[box-shadow] duration-200 ease-(--ease-out-quint)',
          active
            ? 'ring-2 ring-(--surface-invert) ring-offset-2 ring-offset-(--surface)'
            : 'ring-0 ring-transparent',
        )}
      >
        {children}
      </span>
      {/* Sem `truncate`: "Sem preferência" virava "Sem preferê…", e cortar a
          palavra que explica a opção é pior do que deixar quebrar em duas. */}
      <span
        className={cn(
          'w-full text-xs leading-tight text-balance',
          active ? 'font-semibold text-(--text-strong)' : 'text-(--text-muted)',
        )}
      >
        {name}
      </span>
    </Link>
  )
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name
}
