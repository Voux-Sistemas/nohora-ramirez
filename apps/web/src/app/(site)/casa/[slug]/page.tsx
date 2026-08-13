import { weekdayInZone } from '@studio/core'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buttonVariants } from '@/components/ui/button'
import { Photo } from '@/components/ui/photo'
import { Precario } from '@/components/vitrine/precario'
import { Sala } from '@/components/vitrine/sala'
import { Semana } from '@/components/vitrine/horario'
import { formatPhone } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { frasePorta } from '@/server/scheduling/hoje'
import { lojaPorSlug, rede, type Loja } from '@/server/vitrine'

export const dynamic = 'force-dynamic'

/**
 * A casa — o endereço que vai na bio do Instagram.
 *
 * É a única tela do sistema que não serve para fazer nada: serve para a pessoa
 * decidir se quer. Por isso a ordem não é a de um formulário. Primeiro a sala,
 * do tamanho de uma sala. Depois, imediatamente, o que resolve a dúvida de quem
 * já se convenceu — onde fica, se está aberto, como se liga. Só então o resto do
 * ensaio, o preçário inteiro e, no fim, uma porta.
 *
 * O preçário completo está aqui de propósito, e não escondido atrás da marcação.
 * Preço escondido é a coisa que faz uma pessoa fechar a página e perguntar no
 * direct — o salão perde a marcação e ganha uma conversa.
 *
 * A barra de cima e o pé da página vêm da casca (`(site)/layout.tsx`): esta
 * tela é conteúdo, e não mais uma casca com marca própria — que era o defeito
 * do sistema antigo, onde cada área tinha o seu cabeçalho e o seu caminho de
 * volta a lado nenhum.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const loja = await lojaPorSlug(slug)
  if (!loja) return {}

  const morada = [loja.unidade.addressLine, loja.unidade.city].filter(Boolean).join(' · ')

  return {
    title: loja.unidade.name,
    description: morada || undefined,
    openGraph: {
      title: `Nohora Ramirez · ${loja.unidade.name}`,
      description: morada || undefined,
      type: 'website',
      /* A capa da loja é a imagem da partilha. Sem capa, nenhuma imagem — a
         pré-visualização fica só com o texto, que é honesto, em vez de puxar
         uma fotografia de outra casa. */
      images: loja.unidade.imageUrl ? [loja.unidade.imageUrl] : undefined,
    },
  }
}

export default async function CasaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [loja, marca] = await Promise.all([lojaPorSlug(slug), rede()])
  if (!loja) notFound()

  const { unidade: u, fotos, hoje, precario } = loja
  /* A casa já escolhida entra na marcação como parâmetro: quem chegou por aqui
     não deve ter de responder "em que casa?" outra vez. */
  const marcar = `/marcar?casa=${u.slug}`

  /* Sem capa, a primeira do ensaio abre a página — e sai da sala, para não
     aparecer duas vezes na mesma rolagem. */
  const capa = u.imageUrl ?? fotos[0]?.url ?? null
  const daSala = u.imageUrl ? fotos : fotos.slice(1)

  const frase = frasePorta(hoje.estado)

  return (
    <>
      <Abertura unidade={u} capa={capa} frase={frase} aberta={hoje.estado.tipo === 'aberta'} />

      <Essencial loja={loja} instagram={marca?.instagram ?? null} marcar={marcar} />

      {daSala.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-5 pt-16 sm:px-8 sm:pt-24">
          <h2 className="display display-lg">A casa</h2>
          <div className="rule-bronze mt-4 w-14" />
          <div className="mt-8 sm:mt-10">
            <Sala fotos={daSala} nome={u.name} />
          </div>
        </section>
      ) : null}

      {precario.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-5 pt-16 sm:px-8 sm:pt-24">
          <h2 className="display display-lg">Preçário</h2>
          <div className="rule-bronze mt-4 w-14" />
          <p className="text-body measure mt-5 text-[1.0625rem]">
            Os valores são os desta casa. Serviços sobre cabelo comprido, com extensões ou de grande
            volume ficam sujeitos a avaliação no momento.
          </p>
          <div className="mt-10 sm:mt-14">
            <Precario grupos={precario} />
          </div>
        </section>
      ) : null}

      <Fecho unidade={u} marcar={marcar} />
    </>
  )
}

/**
 * A abertura. A fotografia é do tamanho de uma sala e o nome é escrito por
 * cima dela — o logotipo já está na faixa acima, então aqui vale só o lugar.
 */
function Abertura({
  unidade,
  capa,
  frase,
  aberta,
}: {
  unidade: Loja['unidade']
  capa: string | null
  frase: string | null
  aberta: boolean
}) {
  return (
    <section className="relative">
      <Photo
        src={capa}
        alt={`Salão Nohora Ramirez em ${unidade.name}`}
        name={unidade.name}
        priority
        sizes="100vw"
        className="h-[clamp(20rem,62vh,36rem)] w-full"
      />

      <div className="scrim-photo pointer-events-none absolute inset-x-0 bottom-0 h-3/5" aria-hidden />

      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-5xl px-5 pb-8 sm:px-8 sm:pb-12">
          {frase ? (
            <p className="flex items-center gap-2 text-[0.8125rem] text-(--on-ink)">
              {aberta ? (
                <span className="h-1.5 w-1.5 rounded-full bg-(--on-ink-accent)" aria-hidden />
              ) : null}
              {frase}
            </p>
          ) : null}

          <h1 className="display display-xl mt-2 text-(--on-ink)">{unidade.name}</h1>
          <div className="rule-bronze-on-ink mt-5 w-16" />
        </div>
      </div>
    </section>
  )
}

/**
 * O essencial, em três colunas separadas por fio.
 *
 * Não são cartões: são três blocos de texto num mesmo bloco, divididos por uma
 * linha de um pixel. É a diferença entre a ficha de um lugar e uma grade de
 * caixinhas — e a informação aqui é toda do mesmo tipo, então não há hierarquia
 * a inventar entre elas.
 *
 * Cada coluna só existe se tiver o que dizer. Sem horário cadastrado, não há
 * coluna de horário: a página não escreve "a consultar" sobre um campo vazio,
 * porque quem lê isso entende "fechado".
 *
 * A acção de marcar entra imediatamente abaixo — este é o ponto da rolagem em
 * que a pessoa já sabe onde fica e se está aberto, e é onde ela decide.
 */
function Essencial({
  loja,
  instagram,
  marcar,
}: {
  loja: Loja
  instagram: string | null
  marcar: string
}) {
  const { unidade: u, hoje, semana } = loja
  const frase = frasePorta(hoje.estado)
  const diaDeHoje = weekdayInZone(new Date(), u.timezone)

  const morada = [u.addressLine, [u.postalCode, u.city].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const mapa = morada
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `Nohora Ramirez ${u.name}, ${morada}`,
      )}`
    : null

  const colunas: React.ReactNode[] = []

  if (morada) {
    colunas.push(
      <Bloco key="morada" titulo="Morada">
        <p className="text-body text-[0.9375rem] leading-relaxed">
          {u.addressLine}
          {u.postalCode || u.city ? (
            <>
              <br />
              {[u.postalCode, u.city].filter(Boolean).join(' ')}
            </>
          ) : null}
        </p>
        {mapa ? (
          <a
            href={mapa}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[0.875rem] text-(--accent-ink) underline decoration-(--accent)/40 underline-offset-4 transition-colors hover:decoration-(--accent)"
          >
            Ver no mapa
          </a>
        ) : null}
      </Bloco>,
    )
  }

  if (semana.length > 0) {
    colunas.push(
      <Bloco key="horario" titulo="Horário">
        {frase ? <p className="text-[0.9375rem] text-(--text-strong)">{frase}</p> : null}
        <Semana semana={semana} hoje={diaDeHoje} />
        {hoje.excecao ? (
          <p className="text-muted mt-3 text-[0.8125rem] italic">
            Hoje o horário é especial e já está considerado acima.
          </p>
        ) : null}
      </Bloco>,
    )
  }

  if (u.phone || u.email || instagram) {
    colunas.push(
      <Bloco key="contacto" titulo="Contacto">
        <div className="flex flex-col items-start gap-2 text-[0.9375rem]">
          {u.phone ? (
            /* `tel:` e não texto: quem chega do Instagram está no telemóvel, e
               a chamada é a marcação de quem não quer marcar por app. */
            <a href={`tel:${u.phone}`} className="tnum text-(--text-strong) hover:underline">
              {formatPhone(u.phone)}
            </a>
          ) : null}
          {u.email ? (
            <a href={`mailto:${u.email}`} className="text-body break-all hover:underline">
              {u.email}
            </a>
          ) : null}
          {instagram ? (
            <a
              href={`https://instagram.com/${instagram}`}
              target="_blank"
              rel="noreferrer"
              className="text-body hover:underline"
            >
              @{instagram}
            </a>
          ) : null}
        </div>
      </Bloco>,
    )
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-10 sm:px-8 sm:pt-14">
      {colunas.length > 0 ? (
        <div
          className={
            /* Fio entre colunas no ecrã largo, fio entre linhas no telemóvel — a
               mesma divisão, na direcção em que a leitura acontece. */
            'grid divide-y divide-(--border-subtle) border-y border-(--border-subtle) sm:grid-cols-3 sm:divide-x sm:divide-y-0'
          }
        >
          {colunas}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={href(marcar)} className={buttonVariants({ size: 'lg' })}>
          Marcar nesta casa
        </Link>
        {u.phone ? (
          <a
            href={`tel:${u.phone}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'tnum')}
          >
            Ligar {formatPhone(u.phone)}
          </a>
        ) : null}
      </div>
    </section>
  )
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="py-6 sm:px-7 sm:py-8 sm:first:pl-0 sm:last:pr-0">
      <h2 className="label-caps text-muted">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </div>
  )
}

/**
 * O fecho. Uma porta, não um muro de opções.
 *
 * Placa de tinta contida, e não faixa de largura inteira: o pé da página que
 * vem logo a seguir também é de tinta, e duas faixas coladas leriam como um
 * bloco só com uma emenda no meio.
 */
function Fecho({ unidade, marcar }: { unidade: Loja['unidade']; marcar: string }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-5 pt-16 pb-4 sm:px-8 sm:pt-24">
      <div className="rounded-plate bg-(--surface-ink) px-6 py-12 text-center text-(--on-ink) [--focus:var(--on-ink-accent)] sm:px-10 sm:py-16">
        <h2 className="display display-md">Escolha a hora que lhe dá jeito.</h2>
        <p className="mx-auto mt-3 max-w-[40ch] text-[0.9375rem] leading-relaxed text-(--on-ink-muted)">
          A profissional, o dia e a hora numa tela só. A marcação fica confirmada no momento.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4">
          <Link href={href(marcar)} className={buttonVariants({ variant: 'on-ink', size: 'xl' })}>
            Marcar em {unidade.name}
          </Link>
          {unidade.phone ? (
            <a
              href={`tel:${unidade.phone}`}
              className="tnum text-[0.9375rem] text-(--on-ink-muted) transition-colors hover:text-(--on-ink)"
            >
              ou ligue {formatPhone(unidade.phone)}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}
