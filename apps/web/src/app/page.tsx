import { isoDateInZone, zonedDateTime } from '@studio/core'
import { LIVE_APPOINTMENT_STATUSES, appointments, units } from '@studio/db'
import { and, asc, count, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { OperateTopbar } from '@/components/operate/topbar'
import { Photo } from '@/components/ui/photo'
import { db } from '@/lib/db'
import { formatBRL } from '@/lib/format'
import { href } from '@/lib/utils'
import { requireStaffSession } from '@/server/auth/session'

export const dynamic = 'force-dynamic'

interface UnitToday {
  id: string
  name: string
  slug: string
  district: string | null
  timezone: string
  imageUrl: string | null
  agendados: number
  concluidos: number
  faturamento: number
  previsto: number
}

async function loadToday(): Promise<UnitToday[]> {
  const rows = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))

  const result: UnitToday[] = []
  for (const unit of rows) {
    const today = isoDateInZone(new Date(), unit.timezone)
    const dayStart = zonedDateTime(today, '00:00', unit.timezone)
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000)

    const [stats] = await db
      .select({
        agendados: count(),
        concluidos: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`,
        faturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed'), 0)::int`,
        /* O que o dia vale se ninguém faltar. É a pergunta que a dona faz de
           manhã, e ela não existia antes. */
        previsto: sql<number>`coalesce(sum(${appointments.totalPrice}), 0)::int`,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.unitId, unit.id),
          gte(appointments.startsAt, dayStart),
          lt(appointments.startsAt, dayEnd),
          /* Cancelado e falta não são agenda: contá-los inflava tanto o número
             de visitas quanto o previsto. O enum não tem um valor 'cancelled'
             genérico — são três — então quem manda aqui é a lista de status
             que de fato ainda ocupam o horário. */
          inArray(appointments.status, [...LIVE_APPOINTMENT_STATUSES]),
        ),
      )

    result.push({
      id: unit.id,
      name: unit.name,
      slug: unit.slug,
      district: unit.district,
      timezone: unit.timezone,
      imageUrl: unit.imageUrl,
      agendados: stats?.agendados ?? 0,
      concluidos: stats?.concluidos ?? 0,
      faturamento: stats?.faturamento ?? 0,
      previsto: stats?.previsto ?? 0,
    })
  }

  return result
}

/**
 * O dia da rede.
 *
 * Não é painel: é a primeira olhada de quem abriu a loja. Por isso é uma
 * pauta — uma linha por unidade, régua entre elas, número tabular alinhado à
 * direita — e não três placas iguais com caixinhas de métrica dentro. Placa
 * dentro de placa é o desenho que o sistema simples faz sozinho; a pauta é o
 * que um livro de registro de salão sempre foi.
 *
 * A foto da unidade entra pequena e à esquerda, do tamanho de uma etiqueta.
 * Serve para reconhecer a loja de relance — a dona não lê "Jardins", ela vê a
 * sala. É a mesma fotografia que a cliente vê grande no agendamento.
 */
export default async function HomePage() {
  /* A página mostra faturamento de todas as unidades. Antes era pública:
     qualquer um com o endereço lia o caixa da rede. */
  const session = await requireStaffSession()
  const today = await loadToday()

  const total = today.reduce(
    (acc, unit) => ({
      agendados: acc.agendados + unit.agendados,
      concluidos: acc.concluidos + unit.concluidos,
      faturamento: acc.faturamento + unit.faturamento,
      previsto: acc.previsto + unit.previsto,
    }),
    { agendados: 0, concluidos: 0, faturamento: 0, previsto: 0 },
  )

  const agora = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <>
      <OperateTopbar session={session} active="/" />

      {/*
        A pauta é mais estreita que a barra de propósito. Numa tela de 1440 a
        largura cheia jogava o nome da unidade num canto e os números no outro,
        com um metro de nada no meio: ninguém liga uma ponta à outra de relance.
        Coluna curta, olho anda pouco, comparação entre linhas fica imediata.
      */}
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <div>
            <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">
              Hoje na rede
            </h1>
            <p className="text-muted mt-1 text-sm first-letter:uppercase">{agora}</p>
          </div>

          {/*
            O resumo da rede é uma frase, não um mostrador. Quatro números
            grandes no topo seriam o template de métrica que toda ferramenta
            faz; aqui eles moram na linha de baixo do título, do tamanho do
            texto, e quem manda no espaço é a pauta.
          */}
          <p className="text-body text-sm">
            <strong className="tnum text-(--text-strong) font-medium">{total.agendados}</strong>{' '}
            {total.agendados === 1 ? 'visita' : 'visitas'} ·{' '}
            <strong className="tnum text-(--text-strong) font-medium">{formatBRL(total.faturamento)}</strong>{' '}
            no caixa
            {total.previsto > total.faturamento ? (
              <>
                {' '}
                de{' '}
                <span className="tnum">{formatBRL(total.previsto)}</span> previstos
              </>
            ) : null}
          </p>
        </header>

        <div className="mt-7 border-t border-(--border-strong)">
          {today.map((unit) => (
            <UnitRow key={unit.id} unit={unit} />
          ))}
          {today.length === 0 ? (
            <p className="text-muted border-b border-(--border-subtle) px-1 py-8 text-sm">
              Nenhuma unidade ativa. Cadastre a primeira em{' '}
              <Link href="/admin/unidades" className="text-(--text-strong) underline underline-offset-4">
                Cadastros
              </Link>
              .
            </p>
          ) : null}
        </div>
      </main>
    </>
  )
}

function UnitRow({ unit }: { unit: UnitToday }) {
  const restantes = unit.agendados - unit.concluidos

  return (
    <Link
      href={href(`/agenda/${unit.slug}`)}
      className="group -mx-2 flex items-center gap-4 border-b border-(--border-subtle) px-2 py-4 transition-colors hover:bg-(--surface-sunken) sm:gap-5"
    >
      <Photo
        src={unit.imageUrl}
        alt=""
        name={unit.name}
        sizes="64px"
        className="aspect-square w-12 shrink-0 sm:w-16"
        interactive
      />

      <div className="min-w-0 flex-1">
        <h2 className="truncate font-medium">{unit.name}</h2>
        <p className="text-muted truncate text-sm">
          {unit.district ?? '—'}
          <span className="hidden sm:inline">
            {' · '}
            {restantes === 0 ? 'dia encerrado' : `${restantes} por atender`}
          </span>
        </p>
      </div>

      {/*
        Os números alinham à direita e em largura fixa para as três linhas
        formarem coluna — é o que faz a pauta ser lida de cima para baixo, que
        é como se compara unidade com unidade.
      */}
      <dl className="flex shrink-0 items-baseline gap-5 sm:gap-8">
        <Numero label="agenda" value={String(unit.agendados)} />
        <Numero label="feitos" value={String(unit.concluidos)} />
        <Numero label="caixa" value={formatBRL(unit.faturamento)} wide />
      </dl>

      <span
        aria-hidden
        className="text-muted group-hover:text-(--text-strong) hidden transition-[color,transform] group-hover:translate-x-0.5 sm:inline"
      >
        →
      </span>
    </Link>
  )
}

function Numero({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'w-24 text-right sm:w-28' : 'w-10 text-right sm:w-12'}>
      <dd className="tnum text-(--text-strong) text-lg leading-none font-medium sm:text-xl">{value}</dd>
      <dt className="text-muted mt-1 text-xs">{label}</dt>
    </div>
  )
}
