import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wreath } from '@/components/brand/mark'
import { CabecalhoPublico } from '@/components/vitrine/cabecalho'
import { PortaDaCasa } from '@/components/vitrine/porta-da-casa'
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
 *
 * A abertura é de tinta e de vector, não de fotografia, e isso é decisão e não
 * falta: as fotografias do estúdio vêm a 1600px comprimidas, e uma delas em
 * sangria num portátil de alta densidade fica mole — mole numa página que é
 * feita de fotografia é pior do que sóbria. A coroa é SVG e é nítida a
 * qualquer tamanho, portanto é ela que ocupa a parede da entrada. Quando
 * chegarem os originais da cliente, esta faixa aceita uma fotografia sem
 * mudar de forma.
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
  const cidades = [...new Set(unidades.map((u) => u.city).filter((c) => c !== null))]

  return (
    <div className="flex min-h-dvh flex-col">
      <CabecalhoPublico />

      <main className="flex-1">
        {/*
          A entrada. Continua a tinta do cabeçalho sem costura visível, e é
          funda de propósito: as portas por baixo sobem para dentro dela, e a
          faixa passa a ser o fundo das duas em vez de mais um bloco por cima.
          Sem essa sobreposição isto seria um título, um parágrafo e depois
          umas fotografias — que é exactamente o que o cliente chamou de
          documento.
        */}
        <section className="relative overflow-hidden bg-(--surface-ink) pt-14 pb-32 text-(--on-ink) sm:pt-20 sm:pb-44">
          {/*
            A coroa em água-forte, cortada pela margem direita. Uma marca
            inteira e centrada seria um selo — e o selo desta marca já tem
            lugar próprio, no fim da marcação. Aqui ela é textura: reconhece-se
            de relance, não se lê.

            `aspect-square` porque a `Wreath` se mede em altura e largura
            cheias do que a embrulha; sem proporção fixa ela colapsa.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-0 aspect-square w-[24rem] -translate-y-1/2 translate-x-[38%] text-(--on-ink-accent) opacity-[0.09] sm:w-[36rem] lg:w-[42rem]"
          >
            <Wreath />
          </div>

          <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
            <h1 className="display display-xl">As nossas casas</h1>
            <div className="rule-bronze-on-ink mt-5 w-16" />
            {/*
              Uma linha, e curta. A queixa da reunião foi "muita coisa", e a
              entrada é o sítio onde cortar custa menos: quem chega aqui quer
              saber onde é e ver o espaço, e as duas respostas estão nas
              fotografias logo a seguir.
            */}
            <p className="mt-6 max-w-[36ch] text-[1.0625rem] leading-relaxed text-(--on-ink-muted)">
              {cidades.length > 0 ? `${enumerar(cidades)}. ` : ''}A mesma equipa, a mesma mão, duas
              salas.
            </p>
          </div>
        </section>

        {/*
          As portas sobem para dentro da faixa de tinta. O recuo negativo é o
          gesto todo desta tela: sem ele são duas fotografias debaixo de um
          cabeçalho; com ele são duas portas abertas na parede.
        */}
        <section className="relative mx-auto -mt-20 w-full max-w-6xl px-5 pb-20 sm:-mt-28 sm:px-8 sm:pb-28">
          <ul className={colunas(unidades.length)}>
            {unidades.map((unidade, indice) => (
              <li key={unidade.id}>
                <PortaDaCasa
                  unidade={unidade}
                  hoje={portas.get(unidade.id)}
                  priority={indice === 0}
                  sizes={sizesPara(unidades.length)}
                />

                {/*
                  Fora da fotografia porque a fotografia inteira já é um link, e
                  link dentro de link não existe. Telefone à esquerda e marcação
                  à direita: são duas maneiras de marcar, e nenhuma é o plano B
                  da outra — quem não marca por telemóvel liga.
                */}
                <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-1">
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
  "Valongo e Maia", não "Valongo, Maia" — a frase é para se ler em voz alta, e
  uma lista separada por vírgula até ao fim é lista de formulário.
*/
function enumerar(itens: readonly string[]): string {
  if (itens.length <= 1) return itens[0] ?? ''
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

/*
  Duas fotografias lado a lado são um díptico; três, um tríptico. A partir de
  quatro a peça encolhe até virar cartão, e aí esta tela precisa de outro
  desenho e não de mais uma coluna. Mesma régua de `/agendar` — mesma parede.
*/
function colunas(total: number): string {
  const base = 'grid gap-x-6 gap-y-12 sm:gap-x-6'
  if (total === 2) return `${base} sm:grid-cols-2`
  return `${base} sm:grid-cols-2 lg:grid-cols-3`
}

function sizesPara(total: number): string {
  if (total === 2) return '(min-width: 1152px) 532px, (min-width: 640px) 48vw, 100vw'
  return '(min-width: 1152px) 349px, (min-width: 640px) 48vw, 100vw'
}
