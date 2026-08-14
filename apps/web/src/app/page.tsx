import { agruparPorFuso, isoDateInZone, janelaDoMes, zonedDateTime } from '@studio/core'
import { LIVE_APPOINTMENT_STATUSES, appointments, units } from '@studio/db'
import { and, asc, count, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import Link from 'next/link'
import { OperateTopbar } from '@/components/operate/topbar'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { Photo } from '@/components/ui/photo'
import { db } from '@/lib/db'
import { formatMoney, formatMoneyShort } from '@/lib/format'
import { pais } from '@/lib/pais'
import { cn, href } from '@/lib/utils'
import { requireGestao, unidadesVisiveis, type Acesso } from '@/server/auth/permissoes'

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

async function loadToday(acesso: Acesso): Promise<UnitToday[]> {
  const todas = await db.select().from(units).where(eq(units.active, true)).orderBy(asc(units.name))
  /* O recorte vem antes das contagens, não depois: somar o dia de uma loja para
     esconder o número na tela ainda é ler o caixa de quem não é seu. */
  const rows = unidadesVisiveis(acesso, todas)

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

interface MesResumo {
  faturamento: number
  faturamentoAnterior: number
  atendimentos: number
  atendimentosAnterior: number
}

/**
 * O mês em duas somas, para a placa ao lado da pauta.
 *
 * Reaproveita as mesmas unidades que `loadToday` já carregou — não abre outra
 * consulta a `units` nem repete o corte de visibilidade. A janela vem de
 * `janelaDoMes`, a mesma que o painel em `/admin` usa, porque é a mesma
 * pergunta respondida em miniatura.
 */
async function loadMesResumo(unidades: { id: string; timezone: string }[]): Promise<MesResumo> {
  const total: MesResumo = { faturamento: 0, faturamentoAnterior: 0, atendimentos: 0, atendimentosAnterior: 0 }
  if (unidades.length === 0) return total

  const agora = new Date()

  for (const [timezone, doFuso] of agruparPorFuso(unidades)) {
    const mes = janelaDoMes(agora, timezone)
    const ids = doFuso.map((unit) => unit.id)

    const [row] = await db
      .select({
        atendimentos: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs})::int`,
        faturamento: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.inicioTs} and ${appointments.startsAt} < ${mes.fimTs}), 0)::int`,
        atendimentosAnterior: sql<number>`count(*) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.anteriorInicioTs} and ${appointments.startsAt} < ${mes.anteriorFimTs})::int`,
        faturamentoAnterior: sql<number>`coalesce(sum(${appointments.totalPrice}) filter (where ${appointments.status} = 'completed' and ${appointments.startsAt} >= ${mes.anteriorInicioTs} and ${appointments.startsAt} < ${mes.anteriorFimTs}), 0)::int`,
      })
      .from(appointments)
      .where(
        and(
          inArray(appointments.unitId, ids),
          gte(appointments.startsAt, mes.anteriorInicio),
          lt(appointments.startsAt, mes.fim),
        ),
      )

    total.faturamento += row?.faturamento ?? 0
    total.faturamentoAnterior += row?.faturamentoAnterior ?? 0
    total.atendimentos += row?.atendimentos ?? 0
    total.atendimentosAnterior += row?.atendimentosAnterior ?? 0
  }

  return total
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
  /* A página mostra faturamento das lojas. Antes era pública: qualquer um com o
     endereço lia o caixa da rede. Hoje ela é da dona e do gerente — quem atende
     é levado para a própria agenda, que é o "hoje" dela. */
  const acesso = await requireGestao()
  const today = await loadToday(acesso)
  const mes = await loadMesResumo(today)

  const total = today.reduce(
    (acc, unit) => ({
      agendados: acc.agendados + unit.agendados,
      concluidos: acc.concluidos + unit.concluidos,
      faturamento: acc.faturamento + unit.faturamento,
      previsto: acc.previsto + unit.previsto,
    }),
    { agendados: 0, concluidos: 0, faturamento: 0, previsto: 0 },
  )

  const agora = new Date().toLocaleDateString(pais().locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <>
      <OperateTopbar acesso={acesso} active="hoje" />

      {/*
        A pauta continua estreita — coluna curta, olho anda pouco, comparação
        entre linhas fica imediata — mas a página inteira não é mais só ela:
        numa tela larga a pauta sozinha em `max-w-3xl` deixava um vazio sem
        função nas duas margens. A placa do mês ocupa esse lado, sticky, com o
        atalho para o painel completo — a mesma pergunta que a pauta responde
        para hoje, respondida aqui para o mês.
      */}
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
        {/* A pauta do dia é o painel que fica aberto num canto da recepção o dia
            inteiro. Congelado no estado das nove da manhã ele mente. */}
        <AtualizaSozinho />

        <div
          className={cn(
            'lg:items-start lg:gap-16',
            today.length > 0 && 'lg:grid lg:grid-cols-[minmax(0,1fr)_20rem]',
          )}
        >
          <div className="max-w-2xl">
            <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <div>
                {/* "na rede" só é verdade para quem tem a rede. Para o gerente de
                    uma loja o título seria uma promessa que a pauta não cumpre. */}
                <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">
                  {acesso.papel === 'dona' ? 'Hoje na rede' : 'Hoje'}
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
                <strong className="tnum text-(--text-strong) font-medium">
                  {formatMoney(total.faturamento)}
                </strong>{' '}
                no caixa
                {total.previsto > total.faturamento ? (
                  <>
                    {' '}
                    de{' '}
                    <span className="tnum">{formatMoney(total.previsto)}</span> previstos
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
                  {acesso.papel === 'dona' ? (
                    <>
                      Nenhuma unidade ativa. Registe a primeira em{' '}
                      <Link
                        href="/admin/unidades"
                        className="text-(--text-strong) underline underline-offset-4"
                      >
                        Unidades
                      </Link>
                      .
                    </>
                  ) : (
                    /* Mandar o gerente para uma tela que ele não abre seria pior do
                       que não dizer nada. Quem cadastra unidade é a dona. */
                    'Nenhuma loja atribuída a si ainda. Fale com a administração.'
                  )}
                </p>
              ) : null}
            </div>
          </div>

          {today.length > 0 ? (
            <MesCard mes={mes} rede={acesso.papel === 'dona'} />
          ) : null}
        </div>
      </main>
    </>
  )
}

function MesCard({ mes, rede }: { mes: MesResumo; rede: boolean }) {
  const pct =
    mes.faturamentoAnterior > 0
      ? ((mes.faturamento - mes.faturamentoAnterior) / mes.faturamentoAnterior) * 100
      : null

  return (
    <aside className="mt-10 lg:sticky lg:top-10 lg:mt-0">
      <div className="plate p-6">
        <p className="text-muted text-xs font-medium tracking-wide uppercase">
          {rede ? 'O mês da rede' : 'Este mês'}
        </p>
        <p className="display tnum mt-2 text-[2rem] leading-none">{formatMoneyShort(mes.faturamento)}</p>
        <p className="mt-2.5 text-xs">
          {pct === null ? (
            <span className="text-muted">sem comparação — mês passado zerado</span>
          ) : (
            <span className={cn('font-medium', pct >= 0 ? 'text-(--estado-bom)' : 'text-(--estado-mau)')}>
              {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%{' '}
              <span className="text-muted font-normal">vs. mês passado até hoje</span>
            </span>
          )}
        </p>

        <div className="mt-5 border-t border-(--border-subtle) pt-4">
          <p className="tnum text-(--text-strong) text-lg leading-none font-medium">{mes.atendimentos}</p>
          <p className="text-muted mt-1 text-xs">atendimentos concluídos</p>
        </div>

        <Link
          href={href('/admin')}
          className="mt-5 inline-flex items-center gap-1 text-sm text-(--text-strong) underline underline-offset-4"
        >
          Ver painel completo →
        </Link>
      </div>
    </aside>
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
        <Numero label="caixa" value={formatMoney(unit.faturamento)} wide />
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
