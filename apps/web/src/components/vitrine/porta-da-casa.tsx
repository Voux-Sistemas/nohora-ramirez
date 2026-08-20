import Link from 'next/link'
import { EmTransito } from '@/components/ui/espera'
import { Photo } from '@/components/ui/photo'
import { buttonVariants } from '@/components/ui/button'
import { interpola, type Dicionario } from '@/i18n'
import { formatPhone } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import type { UnitInfo } from '@/server/scheduling/context'
import { frasePorta, type HojeNaLoja } from '@/server/scheduling/hoje'

/**
 * A casa como banda, não como cartão.
 *
 * Nasceu com o nome escrito por cima da fotografia, atrás de um véu — vitrine
 * em vez de catálogo, e o argumento continua bom. O que o desmentiu foi o
 * material: as nove fotografias da dona são todas 1600×1066, deitadas, e o
 * recorte 3:4 desta peça ficava com metade da largura. Na Maia a metade que
 * sobrava era a das cadeiras pretas — as prateleiras brancas, os espelhos e a
 * luz, que é o que faz aquela sala bonita, estavam nos lados que o corte
 * deitava fora.
 *
 * Então a peça abre-se em duas. A fotografia fica em 3:2, que é exactamente a
 * proporção do ficheiro: zero recorte, a sala inteira. E o nome passa para uma
 * coluna ao lado, onde pode ser maior do que era e onde a morada, o estado e as
 * duas acções cabem sem disputar com a imagem.
 *
 * Não é o cartão que o sistema recusa: não há ícone, não há título-e-parágrafo
 * repetido, e a fotografia sangra até à beira do ecrã em vez de viver dentro de
 * uma moldura. `espelhada` troca os lados de casa para casa — alternadas são
 * uma parede de retratos; iguais, seriam uma grelha.
 *
 * `.revela` já existe e faz o que é preciso (globals.css): a banda sobe e abre
 * conforme entra, ligada à rolagem e não a um cronómetro, com o estado por
 * omissão já visível. Cuidado herdado que se mantém: `.revela` mexe em
 * `transform`, portanto nada de `position: fixed` cá dentro.
 */
export function PortaDaCasa({
  unidade,
  hoje,
  dic,
  espelhada = false,
  priority = false,
  sizes,
}: {
  unidade: UnitInfo
  hoje?: HojeNaLoja
  dic: Dicionario
  /** Troca a fotografia para a direita. Alterna de casa para casa. */
  espelhada?: boolean
  priority?: boolean
  sizes: string
}) {
  const frase = hoje ? frasePorta(hoje.estado, dic.porta, dic.dias.naFrase) : null
  const aberta = hoje?.estado.tipo === 'aberta'
  const paraACasa = href(`/loja/${unidade.slug}`)

  return (
    <div
      className={cn(
        'revela group/casa grid items-center gap-8 sm:gap-10',
        'lg:grid-cols-[1.3fr_1fr] lg:gap-x-12 xl:gap-x-20',
        espelhada && 'lg:grid-cols-[1fr_1.3fr]',
      )}
    >
      {/*
        A sangria até à beira é o que dá escala à sala: dentro de uma moldura
        com margem dos dois lados, a mesma fotografia lê-se como ilustração de
        um texto. O recuo negativo cancela a goteira da coluna, e só a partir de
        `lg`, que é onde há largura para a peça não ficar espremida.
      */}
      <Link
        href={paraACasa}
        aria-label={interpola(dic.loja.altSalao, { loja: unidade.name })}
        className={cn(
          'group relative block overflow-hidden shadow-(--shadow-lift)',
          espelhada
            ? 'lg:order-2 lg:-mr-5 lg:rounded-l-plate xl:-mr-8'
            : 'lg:-ml-5 lg:rounded-r-plate xl:-ml-8',
        )}
      >
        <EmTransito />
        <Photo
          src={unidade.imageUrl}
          alt={interpola(dic.loja.altSalao, { loja: unidade.name })}
          name={unidade.name}
          interactive
          priority={priority}
          sizes={sizes}
          /* 3:2 é a proporção do ficheiro que a dona mandou. Nenhum pixel
             cortado — e uma banda larga é o que a secção 9 do DESIGN.md já
             pedia para a capa de cada casa. */
          className="aspect-[3/2] w-full"
        />
      </Link>

      <div className={cn('max-w-[30rem]', espelhada && 'lg:order-1')}>
        {/* O fio dá pé à coluna: sem ele o texto flutua ao lado de uma
            fotografia que tem beiras. */}
        <div className="h-px bg-(--border-subtle)" aria-hidden />

        <h2 className="display mt-7 text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.94] sm:mt-9">
          {unidade.name}
        </h2>

        <div className="rule-bronze mt-6 w-28 origin-left scale-x-50 transition-transform duration-700 ease-(--ease-out-quint) group-hover/casa:scale-x-100" />

        {unidade.addressLine ? (
          <p className="text-body mt-7 max-w-[25ch] text-[1.0625rem] leading-snug">
            {unidade.addressLine}
          </p>
        ) : null}

        <p className="text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.9375rem]">
          {frase ? (
            <span className="flex items-center gap-2.5">
              {aberta ? (
                <span className="h-1.5 w-1.5 rounded-full bg-(--accent)" aria-hidden />
              ) : null}
              {frase}
            </span>
          ) : null}
          {frase && unidade.phone ? (
            <span className="text-(--border-subtle)" aria-hidden>
              ·
            </span>
          ) : null}
          {unidade.phone ? (
            <a
              href={`tel:${unidade.phone}`}
              className="tnum transition-colors hover:text-(--text-strong)"
            >
              {formatPhone(unidade.phone)}
            </a>
          ) : null}
        </p>

        {/*
          Duas acções, com pesos diferentes. Nesta tela ninguém decidiu ainda
          marcar — decidiu vir ver —, então quem leva a tinta é "Ver a casa".
          No funil a hierarquia inverte-se, e é para isso que `/agendar` existe.

          Ficam fora da fotografia porque a fotografia inteira já é um link, e
          link dentro de link não existe.
        */}
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href={paraACasa} className={buttonVariants({ variant: 'primary', size: 'lg' })}>
            {dic.loja.verACasa}
            <span aria-hidden>→</span>
          </Link>
          <Link
            href={href(`/agendar/${unidade.slug}`)}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            {interpola(dic.loja.marcarEm, { loja: unidade.name })}
          </Link>
        </div>
      </div>
    </div>
  )
}
