import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UnitPanel } from '@/components/booking/unit-panel'
import { CabecalhoPublico } from '@/components/vitrine/cabecalho'
import { RodapePublico } from '@/components/vitrine/rodape'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import { listUnits } from '@/server/scheduling/context'
import { portaDasUnidades } from '@/server/scheduling/hoje'

export const dynamic = 'force-dynamic'

/**
 * O painel das casas — o endereço que vai na bio do Instagram.
 *
 * Era um reencaminhamento: `/loja` sem nome de casa atirava para `/agendar`,
 * que é o primeiro passo de uma marcação. Quem chegava para *ver* o salão caía
 * dentro de um formulário de três passos com uma barra de progresso por cima, e
 * a resposta à pergunta "que salão é este?" era "passo 1 de 3".
 *
 * Agora é uma tela: as casas do tamanho de uma sala, cada uma com a sua porta
 * para dentro. E são duas portas por casa de propósito — ver e marcar são duas
 * intenções diferentes, e obrigar quem só quer ver a passar pela marcação foi
 * exatamente o defeito de cima.
 *
 * `/agendar` continua a existir e continua a escolher casa. A diferença é o que
 * a pessoa já decidiu quando lá chega: ali já decidiu marcar. Aqui ainda não.
 */

export async function generateMetadata(): Promise<Metadata> {
  const unidades = await listUnits()
  const cidades = [...new Set(unidades.map((u) => u.city).filter(Boolean))].join(' · ')
  const descricao = cidades ? `Cabeleireiro e estética em ${cidades}.` : undefined

  return {
    title: 'As nossas casas',
    description: descricao,
    openGraph: {
      title: 'Nohora Ramirez · Beauty Studio',
      description: descricao,
      type: 'website',
      /* A capa da primeira casa é a imagem da partilha. Sem capa, texto só — o
         cartão do WhatsApp fica honesto em vez de pedir emprestada uma sala. */
      images: unidades.find((u) => u.imageUrl)?.imageUrl
        ? [unidades.find((u) => u.imageUrl)!.imageUrl!]
        : undefined,
    },
  }
}

export default async function PainelDasCasas() {
  const unidades = await listUnits()

  /* Com uma casa só não há painel: escolher entre um é ler o nome dela duas
     vezes. `as never` porque o slug só existe em execução e `typedRoutes` quer
     literal. */
  if (unidades.length === 1) redirect(`/loja/${unidades[0]!.slug}` as never)
  if (unidades.length === 0) redirect('/agendar')

  const portas = await portaDasUnidades(unidades)
  const cidades = [...new Set(unidades.map((u) => u.city).filter(Boolean))]

  return (
    <div className="flex min-h-dvh flex-col">
      <CabecalhoPublico />

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-5 pt-14 sm:px-8 sm:pt-20">
          {cidades.length > 0 ? (
            <p className="label-caps text-muted">{cidades.join(' · ')}</p>
          ) : null}
          <h1 className="display display-xl mt-3">As nossas casas</h1>
          <div className="rule-bronze mt-5 w-16" />
          <p className="text-body measure mt-6 text-[1.0625rem]">
            Cada casa tem a sua sala, a sua equipa e a sua agenda. Entre para ver o espaço, o
            horário e o preçário — ou marque já, na que lhe fica mais à mão.
          </p>
        </section>

        {/*
          O mesmo díptico do primeiro passo da marcação, e de propósito: é a
          mesma escolha, feita mais cedo. Duas fotografias lado a lado, cada uma
          com metade da parede.
        */}
        <section className="mx-auto w-full max-w-5xl px-5 pt-10 pb-16 sm:px-8 sm:pt-14 sm:pb-24">
          <ul className={colunas(unidades.length)}>
            {unidades.map((unidade, indice) => (
              <li key={unidade.id}>
                <UnitPanel
                  unit={unidade}
                  hoje={portas.get(unidade.id)}
                  href={`/loja/${unidade.slug}`}
                  priority={indice === 0}
                  sizes={sizesPara(unidades.length)}
                />

                {/*
                  Fora da fotografia porque a fotografia inteira já é um link, e
                  link dentro de link não existe. Telefone à esquerda e marcação
                  à direita: são duas maneiras de marcar, e nenhuma é o plano B
                  da outra — quem não marca por telemóvel liga.
                */}
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                  {unidade.phone ? (
                    <a
                      href={`tel:${unidade.phone}`}
                      className="tnum text-muted text-[0.9375rem] transition-colors hover:text-(--text-strong)"
                    >
                      {formatPhone(unidade.phone)}
                    </a>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={href(`/agendar/${unidade.slug}`)}
                    className="text-[0.9375rem] text-(--accent-ink) underline decoration-(--accent)/40 underline-offset-4 transition-colors hover:decoration-(--accent)"
                  >
                    Marcar em {unidade.name}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <RodapePublico />
    </div>
  )
}

/*
  Duas fotografias lado a lado são um díptico; três, um tríptico. A partir de
  quatro a peça encolhe até virar cartão, e aí esta tela precisa de outro
  desenho e não de mais uma coluna. Mesma régua de `/agendar` — mesma parede.
*/
function colunas(total: number): string {
  const base = 'grid gap-x-6 gap-y-10 sm:gap-x-6'
  if (total === 2) return `${base} sm:grid-cols-2`
  return `${base} sm:grid-cols-2 lg:grid-cols-3`
}

function sizesPara(total: number): string {
  if (total === 2) return '(min-width: 1024px) 496px, (min-width: 640px) 48vw, 100vw'
  return '(min-width: 1024px) 328px, (min-width: 640px) 48vw, 100vw'
}
