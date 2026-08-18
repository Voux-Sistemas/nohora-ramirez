import { weekdayInZone } from '@studio/core'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Wordmark } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { Photo } from '@/components/ui/photo'
import { CabecalhoPublico } from '@/components/vitrine/cabecalho'
import { Semana } from '@/components/vitrine/horario'
import { IndiceDaCasa } from '@/components/vitrine/indice'
import { Precario } from '@/components/vitrine/precario'
import { RodapePublico } from '@/components/vitrine/rodape'
import { Sala } from '@/components/vitrine/sala'
import { formatPhone } from '@/lib/format'
import { frasePorta } from '@/server/scheduling/hoje'
import { lojaPorSlug, rede, type Loja } from '@/server/vitrine'

export const dynamic = 'force-dynamic'

/**
 * A página da loja — o endereço que vai na bio do Instagram.
 *
 * É a única tela do sistema que não serve para fazer nada: serve para a pessoa
 * decidir se quer. Por isso a ordem não é a de um formulário. Primeiro a sala,
 * do tamanho de uma sala. Depois, imediatamente, o que resolve a dúvida de quem
 * já se convenceu — onde fica, se está aberto, como se liga. Só então o resto do
 * ensaio, o preçário inteiro e, no fim, uma porta.
 *
 * O preçário completo está aqui de propósito, e não escondido atrás da marcação.
 * Preço escondido é a coisa que faz uma pessoa fechar a página e perguntar no
 * direct — o salão perde a marcação e ganha uma conversa. O preçário do estúdio
 * é impresso e está no balcão; publicá-lo não revela nada que a rua já não veja.
 *
 * O QUE MUDOU DEPOIS DA REUNIÃO: "a página está bem cansativa de ler, muita
 * coisa". Nada foi cortado do que a casa tem para dizer — cortar preçário para
 * a página parecer curta é resolver a leitura à custa da cliente. O que entrou
 * foi forma de a percorrer: uma barra colada com as secções e o botão de
 * marcar, cada bloco a entrar quando é atravessado, e a abertura a ocupar o
 * ecrã em vez de ser uma faixa. Uma página comprida não cansa; uma página
 * comprida sem mapa, sim.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ unidade: string }>
}): Promise<Metadata> {
  const { unidade } = await params
  const loja = await lojaPorSlug(unidade)
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

export default async function LojaPage({ params }: { params: Promise<{ unidade: string }> }) {
  const { unidade } = await params
  const [loja, marca] = await Promise.all([lojaPorSlug(unidade), rede()])
  if (!loja) notFound()

  const { unidade: u, fotos, hoje, precario } = loja
  const marcar = `/agendar/${u.slug}`
  const instagram = marca?.instagram ?? null

  /* Sem capa, a primeira do ensaio abre a página — e sai da sala, para não
     aparecer duas vezes na mesma rolagem. */
  const capa = u.imageUrl ?? fotos[0]?.url ?? null
  const daSala = u.imageUrl ? fotos : fotos.slice(1)

  /* O índice só nomeia o que a página realmente tem. Uma casa sem ensaio
     fotográfico não ganha um separador "A casa" que salta para lado nenhum. */
  const seccoes = [
    temEssencial(loja, instagram) ? { id: 'onde', rotulo: 'Onde nos encontra' } : null,
    daSala.length > 0 ? { id: 'casa', rotulo: 'A casa' } : null,
    precario.length > 0 ? { id: 'precario', rotulo: 'Preçário' } : null,
  ].filter((s) => s !== null)

  return (
    <div className="flex min-h-dvh flex-col">
      <CabecalhoPublico atual={u.slug} marcar={marcar} />

      <main className="flex-1">
        <Abertura
          unidade={u}
          capa={capa}
          frase={frasePorta(hoje.estado)}
          aberta={hoje.estado.tipo === 'aberta'}
        />

        {/* Colada logo abaixo da abertura, e a única barra colada da página:
            ver `indice.tsx` para o porquê de o cabeçalho continuar a rolar. */}
        <IndiceDaCasa seccoes={seccoes} marcar={marcar} />

        <Essencial loja={loja} instagram={instagram} />

        {daSala.length > 0 ? (
          <section
            id="casa"
            className="revela mx-auto w-full max-w-5xl scroll-mt-24 px-5 pt-16 sm:px-8 sm:pt-24"
          >
            <h2 className="display display-lg">A casa</h2>
            <div className="rule-bronze mt-4 w-14" />
            <div className="mt-8 sm:mt-10">
              <Sala fotos={daSala} nome={u.name} />
            </div>
          </section>
        ) : null}

        {precario.length > 0 ? (
          /*
            A FOLHA. O preçário é o único bloco da montra que é um objecto e não
            uma vista da casa: é o cartão que fica no balcão. Dar-lhe chão
            próprio — faixa de `--surface-raised` de bordo a bordo, com fio em
            cima e em baixo — é o que o separa da página em vez de o deixar a
            flutuar no mesmo bege de tudo o resto, que foi a queixa de "design
            muito simples". Não é cartão dentro de cartão nem grade de cartões:
            é uma folha, uma vez, para a secção inteira.

            E não é só aparência: a tarja alternada da tabela comparada é o bege
            da página a aparecer por baixo desta folha. Sem a folha não havia
            contraste nenhum para a tarja, e teria de se inventar uma cor.

            O feitio da faixa (`mt` fora, `py` e `max-w-5xl` dentro) é o mesmo
            do `Fecho`, logo abaixo — duas faixas de bordo a bordo na mesma
            página têm de se medir da mesma maneira.
          */
          <section
            id="precario"
            className="revela mt-16 scroll-mt-24 border-y border-(--border-subtle) bg-(--surface-raised) py-16 sm:mt-24 sm:py-24"
          >
            <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
              <h2 className="display display-lg">Preçário</h2>
              <div className="rule-bronze mt-4 w-14" />
              {/* Sem parágrafo de abertura: a ressalva sobre cabelo comprido e
                  grande volume já está ao pé do bloco a que se aplica, que é
                  onde a dúvida aparece. Dizê-la duas vezes era a "muita coisa"
                  da queixa em ponto pequeno. */}
              <div className="mt-10 sm:mt-14">
                <Precario grupos={precario} />
              </div>
            </div>
          </section>
        ) : null}

        <Fecho unidade={u} marcar={marcar} />
      </main>

      <RodapePublico atual={u.slug} />
    </div>
  )
}

/**
 * A abertura. A fotografia é do tamanho de uma sala e o nome é escrito por
 * cima dela — o logotipo já está na faixa acima, então aqui vale só o lugar.
 *
 * `svh` e não `vh` nem `dvh`: no telemóvel, `dvh` muda de valor enquanto a
 * barra de endereço encolhe, e a fotografia mudava de altura a meio da
 * rolagem. `svh` é a altura pequena e estável — a abertura não salta.
 *
 * O estado da porta passa a pastilha, o mesmo objecto do painel das casas: é a
 * única informação desta faixa que muda ao longo do dia, e informação que muda
 * quer contorno próprio em vez de se confundir com o nome da casa.
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
    <section className="relative overflow-hidden">
      <Photo
        src={capa}
        alt={`Salão Nohora Ramirez em ${unidade.name}`}
        name={unidade.name}
        priority
        paralaxe
        sizes="100vw"
        className="h-[clamp(24rem,74svh,44rem)] w-full"
      />

      <div
        className="scrim-photo pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
        aria-hidden
      />

      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-5xl px-5 pb-9 sm:px-8 sm:pb-14">
          {frase ? (
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-(--surface-ink)/78 px-3 py-1.5 text-[0.75rem] text-(--on-ink)">
              {aberta ? (
                <span className="h-1.5 w-1.5 rounded-full bg-(--on-ink-accent)" aria-hidden />
              ) : null}
              {frase}
            </p>
          ) : null}

          <h1 className="display display-xl text-(--on-ink)">{unidade.name}</h1>
          <div className="rule-bronze-on-ink mt-5 w-16" />
        </div>
      </div>
    </section>
  )
}

/**
 * Há alguma coisa para pôr em "Onde nos encontra"?
 *
 * A pergunta é feita em dois sítios — pelo índice, para decidir se nomeia a
 * secção, e pela própria secção, para decidir se existe — e as duas respostas
 * têm de ser a mesma. Um separador que salta para uma secção que não foi
 * desenhada é pior do que não ter separador nenhum.
 */
function temEssencial(loja: Loja, instagram: string | null): boolean {
  const { unidade: u, semana } = loja
  return Boolean(u.addressLine) || semana.length > 0 || Boolean(u.phone || u.email || instagram)
}

/**
 * Onde nos encontra — a placa da porta, e não três colunas apagadas.
 *
 * A queixa da reunião foi literal: "morada e horário meio apagado, morto". E era
 * verdade por três motivos somados. Este bloco era o único da página sem voz de
 * display e sem régua de bronze, num sítio onde as vizinhas ("A casa",
 * "Preçário") têm as duas; tinha a letra mais pequena da montra a dizer a
 * informação mais procurada dela; e respirava metade do que as vizinhas
 * respiram. Três sinais de "isto é rodapé" numa secção que é a razão de metade
 * das visitas.
 *
 * A correção não foi escurecer o cinzento — o contraste já passava. Foi dar-lhe
 * o peso que o conteúdo tem. A morada e o estado da porta passam a Bodoni, que
 * é a voz que esta casa usa quando fala a sério, e são hoje o segundo e o
 * terceiro maior tipo da página, atrás só do nome da loja. O bloco ganha fundo
 * próprio e o ar das outras secções.
 *
 * Duas colunas desiguais, e não três iguais: morada e horário são o que se
 * procura, contacto é o que se usa depois de decidir. Três colunas do mesmo
 * tamanho diziam que as três perguntas pesam o mesmo, e não pesam.
 *
 * Cada bloco só existe se tiver o que dizer. Sem horário cadastrado, não há
 * coluna de horário: a página não escreve "a consultar" sobre um campo vazio,
 * porque quem lê isso entende "fechado".
 */
function Essencial({ loja, instagram }: { loja: Loja; instagram: string | null }) {
  const { unidade: u, hoje, semana } = loja
  const frase = frasePorta(hoje.estado)
  const aberta = hoje.estado.tipo === 'aberta'
  const diaDeHoje = weekdayInZone(new Date(), u.timezone)

  const localidade = [u.postalCode, u.city].filter(Boolean).join(' ')
  const morada = [u.addressLine, localidade].filter(Boolean).join(', ')
  const mapa = morada
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `Nohora Ramirez ${u.name}, ${morada}`,
      )}`
    : null

  if (!temEssencial(loja, instagram)) return null

  return (
    <section
      id="onde"
      className="revela scroll-mt-24 border-y border-(--border-subtle) bg-(--surface-sunken)"
    >
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <h2 className="display display-lg">Onde nos encontra</h2>
        <div className="rule-bronze mt-4 w-14" />

        <div className="mt-10 grid gap-12 sm:mt-14 sm:grid-cols-12 sm:gap-14">
          {morada ? (
            <div className="sm:col-span-7">
              <h3 className="label-caps text-muted">Morada</h3>

              {/* A rua em Bodoni. É a linha que a cliente copia para o mapa e a
                  que ela lê em voz alta ao motorista — merece o corpo que tem. */}
              <p className="display display-md mt-4 max-w-[22ch] leading-[1.14] text-(--text-strong)">
                {u.addressLine}
              </p>
              {localidade ? (
                <p className="text-body mt-2.5 text-[1.0625rem]">{localidade}</p>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3">
                {mapa ? (
                  <a
                    href={mapa}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[0.9375rem] text-(--accent-ink) underline decoration-(--accent)/40 underline-offset-4 transition-colors hover:decoration-(--accent)"
                  >
                    Ver no mapa
                  </a>
                ) : null}
                {u.phone ? (
                  /* `tel:` e não texto: quem chega do Instagram está no
                     telemóvel, e a chamada é a marcação de quem não quer
                     marcar por app. */
                  <a
                    href={`tel:${u.phone}`}
                    className="tnum text-[0.9375rem] text-(--text-strong) underline decoration-(--border-strong) underline-offset-4 transition-colors hover:decoration-(--text-strong)"
                  >
                    {formatPhone(u.phone)}
                  </a>
                ) : null}
              </div>

              {u.email || instagram ? (
                <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-(--border-subtle) pt-6">
                  {u.email ? (
                    <a
                      href={`mailto:${u.email}`}
                      className="text-body text-[0.9375rem] break-all hover:text-(--text-strong)"
                    >
                      {u.email}
                    </a>
                  ) : null}
                  {instagram ? (
                    <a
                      href={`https://instagram.com/${instagram}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-body text-[0.9375rem] hover:text-(--text-strong)"
                    >
                      @{instagram}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {semana.length > 0 ? (
            <div className="sm:col-span-5">
              <h3 className="label-caps text-muted">Horário</h3>

              {/* O estado da porta é a pergunta que traz a pessoa a esta secção.
                  Estava numa linha de 15px entre outras duas; agora é a segunda
                  voz da página. */}
              {frase ? (
                <p className="display display-md mt-4 flex items-baseline gap-3 text-(--text-strong)">
                  {aberta ? (
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 translate-y-[-0.3em] rounded-full bg-(--accent)"
                    />
                  ) : null}
                  {frase}
                </p>
              ) : null}

              <Semana semana={semana} hoje={diaDeHoje} className="mt-7" />

              {hoje.excecao ? (
                <p className="text-muted mt-5 text-[0.875rem] italic">
                  Hoje o horário é especial e já está considerado acima.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

/**
 * O fecho. Uma porta, não um muro de opções.
 *
 * Faixa de tinta porque é o gesto que o sistema já usa para "aqui é a marca a
 * falar" — a mesma faixa do topo, agora do tamanho de um bloco. O telefone fica
 * ao lado do botão em vez de dentro dele: são duas maneiras diferentes de a
 * mesma pessoa marcar, e uma não é o plano B da outra.
 */
function Fecho({ unidade, marcar }: { unidade: Loja['unidade']; marcar: string }) {
  return (
    <section className="mt-16 bg-(--surface-ink) text-(--on-ink) sm:mt-24">
      <div className="mx-auto w-full max-w-5xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <Wordmark size="lg" className="text-(--on-ink)" />

        <p className="mx-auto mt-8 max-w-[38ch] text-[1.0625rem] leading-relaxed text-(--on-ink-muted)">
          Escolha a profissional, o dia e a hora. A marcação fica confirmada no momento.
        </p>

        <div className="mt-9 flex flex-col items-center gap-4">
          <Link href={marcar as never} className={buttonVariants({ variant: 'on-ink', size: 'xl' })}>
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
