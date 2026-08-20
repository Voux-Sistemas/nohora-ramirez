import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Wreath } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { Photo } from '@/components/ui/photo'
import { CabecalhoPublico } from '@/components/vitrine/cabecalho'
import { PortaDaCasa } from '@/components/vitrine/porta-da-casa'
import { RodapePublico } from '@/components/vitrine/rodape'
import { dicionario, interpola } from '@/i18n'
import { lerIdioma } from '@/lib/idioma'
import { href } from '@/lib/utils'
import { listUnits } from '@/server/scheduling/context'
import { portaDasUnidades } from '@/server/scheduling/hoje'
import { rede } from '@/server/vitrine'

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
 * A abertura recusava fotografia porque as imagens vêm comprimidas a 1600px e
 * uma delas em sangria, num portátil de alta densidade, fica mole. O argumento
 * continua verdadeiro — em sangria. A meia largura não: são 1600px de origem
 * para ocupar uns 600, e sobra definição. Por isso a parede da direita aceita
 * agora uma fotografia — `settings.montraFoto` na organização —, e cai na coroa
 * em água-forte quando não há nenhuma. As duas versões são desenho; nenhuma
 * delas é a falta da outra.
 */

export async function generateMetadata(): Promise<Metadata> {
  const [unidades, idioma] = await Promise.all([listUnits(), lerIdioma()])
  const dic = dicionario(idioma)
  const cidades = [...new Set(unidades.map((u) => u.city).filter(Boolean))].join(' · ')
  const descricao = cidades ? interpola(dic.meta.lojaDescricao, { cidades }) : undefined

  return {
    title: dic.meta.lojaTitulo,
    description: descricao,
    openGraph: {
      title: dic.meta.lojaOg,
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
  const [unidades, idioma] = await Promise.all([listUnits(), lerIdioma()])
  const dic = dicionario(idioma)

  /* Com uma casa só não há painel: escolher entre um é ler o nome dela duas
     vezes. `as never` porque o slug só existe em execução e `typedRoutes` quer
     literal. */
  if (unidades.length === 1) redirect(`/loja/${unidades[0]!.slug}` as never)
  if (unidades.length === 0) redirect('/agendar')

  const [portas, marca] = await Promise.all([portaDasUnidades(unidades), rede()])
  const cidades = [...new Set(unidades.map((u) => u.city).filter((c) => c !== null))]

  return (
    <div className="flex min-h-dvh flex-col">
      <CabecalhoPublico idioma={idioma} />

      <main className="flex-1">
        {/*
          A abertura era tinta chapada com a coroa por cima. De longe lia-se
          como um rectângulo preto com um risco: a cor não tinha luz nenhuma e
          a coroa, a 9% de opacidade, não chegava a ser textura.

          Passa a ter as duas coisas. O clarão quente em cima à esquerda dá-lhe
          profundidade sem sair da família da tinta, e a `.trama-escovada` por
          cima dá-lhe matéria — metal escovado, que é o material de onde vem o
          bronze da casa. Ambos são gradientes: não há ficheiro a descarregar.
        */}
        <section className="relative overflow-hidden bg-(--surface-ink) text-(--on-ink) [background-image:radial-gradient(118%_92%_at_7%_10%,oklch(0.252_0.018_53)_0%,oklch(0.204_0.015_49)_40%,oklch(0.164_0.012_47)_76%,oklch(0.147_0.011_46)_100%)]">
          <div aria-hidden className="trama-escovada pointer-events-none absolute inset-0" />

          {/*
            Cantos a traço — o enquadramento de uma prova de cor. Dois, em
            diagonal, e não os quatro: quatro fecham uma moldura, dois dizem
            que há enquadramento e deixam a peça respirar para fora.
          */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-4 left-4 h-8 w-8 border-t border-l border-(--border-on-ink) sm:top-6 sm:left-6 sm:h-11 sm:w-11"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute right-4 bottom-4 h-8 w-8 border-r border-b border-(--border-on-ink) sm:right-6 sm:bottom-6 sm:h-11 sm:w-11"
          />

          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 pt-12 pb-32 sm:px-8 sm:pt-16 sm:pb-44 lg:grid-cols-[1fr_0.58fr] lg:items-stretch lg:gap-14 lg:pb-48">
            <div className="lg:py-6">
              {/*
                O único sobrolho em versalete da montra inteira. O sistema
                recusa-o acima de *cada* secção — é a repetição que o torna
                andaime, não a forma —, e aqui ele diz um facto que não está
                escrito em mais lado nenhum: onde é que as casas ficam.
              */}
              {cidades.length > 0 ? (
                <p className="label-caps text-(--on-ink-muted) flex items-center gap-3.5">
                  <span aria-hidden className="block h-px w-8 bg-(--on-ink-accent)" />
                  {enumerar(cidades, dic.gramatica.enumeracao)}
                </p>
              ) : null}

              <h1 className="display display-xl mt-7">{dic.loja.titulo}</h1>
              <div className="rule-bronze-on-ink mt-6 w-16" />

              {/*
                Uma linha, e curta. A queixa da reunião foi "muita coisa", e a
                entrada é o sítio onde cortar custa menos: quem chega aqui quer
                saber onde é e ver o espaço, e as duas respostas estão nas
                fotografias logo a seguir.
              */}
              <p className="mt-7 max-w-[34ch] text-[1.0625rem] leading-relaxed text-(--on-ink-muted)">
                {dic.loja.intro}
              </p>

              {/*
                A marcação passa a estar à mão logo na abertura. É a única
                coisa que as montras de salão que servem de referência fazem
                melhor do que esta: pedir a marcação sem obrigar a rolar.
              */}
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href={href('/agendar')}
                  className={buttonVariants({ variant: 'on-ink', size: 'lg' })}
                >
                  {dic.chrome.marcarOnline}
                  <span aria-hidden>→</span>
                </Link>
                <a href="#casas" className={buttonVariants({ variant: 'on-ink-outline', size: 'lg' })}>
                  {dic.chrome.verAsCasas}
                  <span aria-hidden>↓</span>
                </a>
              </div>
            </div>

            {/*
              A parede da direita. Com fotografia da casa é uma sala; sem ela,
              a coroa em água-forte, que é o que a abertura sempre teve.

              O DESIGN.md recusa fotografia em sangria nesta abertura porque as
              imagens vêm comprimidas a 1600px e "uma delas em sangria num
              portátil de alta densidade fica mole". A meia largura o problema
              não existe — são 1600px de origem para ocupar uns 600 — e é por
              isso que ela entra aqui e não de bordo a bordo.
            */}
            <div className="relative -mx-5 min-h-[18rem] overflow-hidden sm:-mx-8 lg:mx-0 lg:-mr-8 lg:rounded-l-plate">
              {marca?.montraFoto ? (
                <>
                  <Photo
                    src={marca.montraFoto}
                    alt={dic.loja.altAbertura}
                    name={marca.nome}
                    priority
                    paralaxe
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    className="h-full min-h-[18rem] w-full"
                  />
                  {/* Véu na beira que encosta ao texto, para a fotografia não
                      disputar com o título. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-100 from-(--surface-ink)/75 via-(--surface-ink)/20 via-30% to-transparent to-60%"
                  />
                </>
              ) : (
                <div
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-0 aspect-square w-[26rem] -translate-y-1/2 translate-x-[30%] text-(--on-ink-accent) opacity-[0.15] sm:w-[34rem]"
                >
                  <Wreath />
                </div>
              )}
            </div>
          </div>
        </section>

        {/*
          As portas sobem para dentro da faixa de tinta. O recuo negativo é o
          gesto todo desta tela: sem ele são duas fotografias debaixo de um
          cabeçalho; com ele são duas portas abertas na parede.
        */}
        {/*
          As casas já não sobem para dentro da faixa de tinta. O recuo negativo
          era o gesto desta tela — e era-o com duas peças a subir ao mesmo
          tempo, que comiam o subtítulo e a régua atrás delas. Com bandas
          inteiras não há como fazê-lo sem partir alguma coisa, e o ar entre as
          secções faz o trabalho que a sobreposição tentava fazer.

          O espaço entre casas é grande de propósito: numa tela que pede uma
          decisão entre duas coisas, o espaço à volta de cada uma *é* a forma de
          as separar.
        */}
        <section
          id="casas"
          className="mx-auto w-full max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28 lg:py-36"
        >
          <ul className="flex flex-col gap-24 sm:gap-32 lg:gap-44">
            {unidades.map((unidade, indice) => (
              <li key={unidade.id}>
                <PortaDaCasa
                  unidade={unidade}
                  hoje={portas.get(unidade.id)}
                  dic={dic}
                  espelhada={indice % 2 === 1}
                  priority={indice === 0}
                  sizes={sizesPara()}
                />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <RodapePublico idioma={idioma} />
    </div>
  )
}

/*
  "Valongo e Maia", não "Valongo, Maia" — a frase é para se ler em voz alta, e
  uma lista separada por vírgula até ao fim é lista de formulário.

  A conjunção vem do dicionário porque é a única parte disto que muda de língua:
  a vírgula é igual nas três, o "e" é "and" e "y".
*/
function enumerar(itens: readonly string[], conjuncao: string): string {
  if (itens.length <= 1) return itens[0] ?? ''
  return interpola(conjuncao, {
    lista: itens.slice(0, -1).join(', '),
    ultimo: itens[itens.length - 1]!,
  })
}

/*
  A banda ocupa sempre a fila inteira, portanto a largura da fotografia já
  não depende de quantas casas há — depende da coluna de 1.3fr e da sangria
  de 32px que ela ganha ao encostar à beira.
*/
function sizesPara(): string {
  return '(min-width: 1024px) 608px, 100vw'
}
