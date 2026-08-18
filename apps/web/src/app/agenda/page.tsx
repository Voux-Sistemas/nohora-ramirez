import { isIsoDate } from '@studio/core'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DayList } from '@/components/agenda/day-list'
import { NavegadorDeDia } from '@/components/agenda/navegador-de-dia'
import { SemLoja } from '@/components/operate/sem-loja'
import { AtualizaSozinho } from '@/components/ui/atualiza-sozinho'
import { formatMoney } from '@/lib/format'
import { href } from '@/lib/utils'
import { podeGerir, requireAcesso, unidadesVisiveis } from '@/server/auth/permissoes'
import { todayInUnit } from '@/server/scheduling/availability'
import { listUnits } from '@/server/scheduling/context'
import {
  CANCELADOS,
  countDay,
  listDayAppointments,
  soDaProfissional,
} from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'

/**
 * O dia das lojas todas, lado a lado.
 *
 * Aqui viveu um reencaminhamento: `/agenda` sozinho atirava a pessoa para a
 * primeira loja da lista dela. Era conveniente e era mentira — a barra oferecia
 * um endereço que ninguém podia abrir, e quem estava na Maia a olhar para o dia
 * 27 e voltava aterrava em Valongo, hoje. Duas coisas que ninguém pediu.
 *
 * Agora "Todas" é um sítio. É o que faltava ao seletor de loja para deixar de
 * ser uma escolha entre duas e passar a ser uma vista: a dona abre a agenda e vê
 * o Valongo e a Maia no mesmo dia, sem escolher primeiro.
 *
 * É uma vista, não um posto de trabalho. Não há grade de cadeiras, não há
 * encaixe e não há ficha de cliente — para isso entra-se numa loja, e cada
 * atendimento é a porta para lá. Uma grade que misturasse as cadeiras das duas
 * lojas numa coluna só desenharia um salão que não existe.
 *
 * Com uma loja só isto não é vista nenhuma: é a mesma agenda com um cabeçalho a
 * mais, e o reencaminhamento continua a ser a resposta certa.
 */
export default async function AgendaDeTodasAsLojasPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>
}) {
  const acesso = await requireAcesso()
  const { d } = await searchParams
  const unidades = unidadesVisiveis(acesso, await listUnits())

  if (unidades.length === 0) return <SemLoja titulo="Agenda do dia" />
  if (unidades.length === 1) {
    redirect(`/agenda/${unidades[0]!.slug}${isIsoDate(d) ? `?d=${d}` : ''}` as never)
  }

  const gerir = podeGerir(acesso)

  /* A data é uma só para as duas lojas — é um dia de parede, e a rede inteira
     está no mesmo país. Se um dia houver loja noutro fuso, é aqui que se parte:
     o "hoje" deixa de ser um. */
  const hoje = todayInUnit(unidades[0]!)
  const date = isIsoDate(d) ? d : hoje
  const agora = new Date()

  const lojas = await Promise.all(
    unidades.map(async (unit) => {
      const todos = await listDayAppointments(unit, date)
      /* Mesmo recorte da agenda de uma loja: a profissional que atende nas duas
         vê aqui o dia dela inteiro, e não o das colegas. */
      const seus = gerir ? todos : soDaProfissional(todos, acesso.staffId)
      return {
        unit,
        live: seus.filter((item) => !CANCELADOS.has(item.status)),
        contagem: countDay(seus),
      }
    }),
  )

  const naAgenda = lojas.reduce((soma, loja) => soma + loja.contagem.reserved, 0)
  const noCaixa = lojas.reduce((soma, loja) => soma + loja.contagem.revenue, 0)

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
      {/* Dia que já passou não muda mais — ali o tique seria só gasto. */}
      <AtualizaSozinho ativo={date >= hoje} />

      <header className="mb-6">
        <h1 className="display text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">
          Todas as lojas
        </h1>
        <p className="text-body mt-2 text-sm">
          <Num>{naAgenda}</Num> na agenda
          {gerir && noCaixa > 0 ? (
            <>
              {' · '}
              <Num>{formatMoney(noCaixa)}</Num> no caixa
            </>
          ) : null}
        </p>

        <NavegadorDeDia base="/agenda" date={date} today={hoje} className="mt-4" />
      </header>

      {/*
        Uma coluna por loja a partir de `lg`, empilhadas antes disso. São duas
        listas do mesmo dia, e postas lado a lado respondem à pergunta que traz
        alguém a esta tela: onde é que está a sobrar gente e onde é que está a
        faltar. No telemóvel a comparação é impossível de qualquer maneira, e
        duas colunas de metade da largura só partiriam os nomes das clientes.
      */}
      <div className="grid gap-6 lg:grid-cols-2">
        {lojas.map(({ unit, live, contagem }) => {
          const baseHref = `/agenda/${unit.slug}?d=${date}`
          return (
            <section key={unit.id} className="min-w-0">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="display text-[1.25rem] leading-tight font-normal">{unit.name}</h2>
                {/* O nome da loja é título, e título não é link. A porta fica
                    escrita por extenso, do lado onde já se lê o resto. */}
                <Link
                  href={href(baseHref)}
                  className="text-muted hover:text-(--text-strong) text-sm whitespace-nowrap transition-colors"
                >
                  abrir agenda →
                </Link>
              </div>

              <p className="text-body mb-3 text-sm">
                <Num>{contagem.reserved}</Num> na agenda
                {contagem.completed > 0 ? (
                  <>
                    {' · '}
                    <Num>{contagem.completed}</Num> concluído{contagem.completed === 1 ? '' : 's'}
                  </>
                ) : null}
                {contagem.cancelled > 0 ? (
                  <>
                    {' · '}
                    <Num>{contagem.cancelled}</Num> cancelado{contagem.cancelled === 1 ? '' : 's'}
                  </>
                ) : null}
                {gerir ? (
                  <>
                    {' · '}
                    <Num>{formatMoney(contagem.revenue)}</Num> no caixa
                  </>
                ) : null}
              </p>

              {/*
                `foco` a `null` para quem gere, como na lista de uma loja: o vão
                da equipa inteira não é vão de ninguém, e nomear cada linha é o
                que diz quem atende. Para a profissional o foco é ela, e a lista
                volta a medir os buracos do dia dela.
              */}
              <DayList
                timezone={unit.timezone}
                appointments={live}
                baseHref={baseHref}
                foco={gerir ? null : acesso.staffId}
                agora={date === hoje ? agora : null}
                comValor={gerir}
              />
            </section>
          )
        })}
      </div>
    </main>
  )
}

/** Número dentro da frase do dia: mesmo corpo do texto, só mais tinta. */
function Num({ children }: { children: React.ReactNode }) {
  return <strong className="tnum text-(--text-strong) font-medium">{children}</strong>
}
