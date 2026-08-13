import Link from 'next/link'
import { Photo } from '@/components/ui/photo'
import { cn } from '@/lib/utils'
import { frasePorta, type HojeNaLoja } from '@/server/scheduling/hoje'
import type { UnitInfo } from '@/server/scheduling/context'

/**
 * A loja como fotografia inteira, não como cartão.
 *
 * A diferença é o que está por cima. Cartão põe a foto num quadro e o texto
 * embaixo, num bloco de superfície; aqui a fotografia ocupa a peça toda e o
 * nome é escrito sobre ela, atrás de um véu. O primeiro é catálogo, o segundo é
 * vitrine — e a decisão que esta tela pede ("em qual destas salas eu quero
 * passar duas horas?") é uma decisão de vitrine.
 *
 * Isto NÃO é a grade de cartões idênticos que o sistema recusa: não há ícone,
 * não há título-e-parágrafo repetido, e o conteúdo de cada peça é uma sala
 * diferente. O que se repete é a moldura, como numa parede de retratos.
 *
 * Sem foto, a placa desenhada da marca assume — já é tinta escura, então o véu
 * e o texto continuam legíveis sem nenhum caso especial.
 */
export function UnitPanel({
  unit,
  hoje,
  href,
  priority = false,
  sizes,
  className,
}: {
  unit: UnitInfo
  hoje?: HojeNaLoja
  href: string
  priority?: boolean
  sizes: string
  className?: string
}) {
  const frase = hoje ? frasePorta(hoje.estado) : null
  const aberta = hoje?.estado.tipo === 'aberta'

  return (
    <Link
      href={href as never}
      className={cn(
        'group relative block overflow-hidden rounded-plate',
        /* O fio some sob a fotografia e aparece na placa vazia, onde a peça
           precisa de borda para não vazar no fundo escuro. */
        'ring-1 ring-(--border-subtle)',
        className,
      )}
    >
      <Photo
        src={unit.imageUrl}
        alt={`Salão ${unit.name}`}
        name={unit.name}
        interactive
        priority={priority}
        sizes={sizes}
        /*
          Retrato só a partir de `sm`, onde as peças ficam lado a lado. Em
          coluna única, dois 4:5 de largura inteira dão uma página de rolagem
          longa para uma escolha de dois itens — e rolar não é escolher.
        */
        className="aspect-[16/11] w-full sm:aspect-[4/5]"
      />

      {/* O véu ocupa a metade de baixo: em cima a sala fica limpa. */}
      <div className="scrim-photo pointer-events-none absolute inset-x-0 bottom-0 h-3/5" aria-hidden />

      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
        {frase ? (
          <p
            className={cn(
              'flex items-center gap-2 text-[0.8125rem]',
              // Aberto é mais claro que fechado: o estado tem forma, não só palavra.
              aberta ? 'text-(--on-ink)' : 'text-(--on-ink-muted)',
            )}
          >
            {aberta ? (
              <span className="h-1.5 w-1.5 rounded-full bg-(--on-ink-accent)" aria-hidden />
            ) : null}
            {frase}
          </p>
        ) : null}

        {/* Bodoni bem acima do piso de 28px — é o maior tipo da tela. */}
        <h2 className="display mt-1.5 text-[2rem] leading-[1.02] text-(--on-ink) sm:text-[2.375rem]">
          {unit.name}
        </h2>

        <div className="rule-bronze-on-ink mt-3.5 w-10 transition-[width] duration-700 ease-(--ease-out-quint) group-hover:w-16" />

        {unit.addressLine ? (
          <p className="mt-3.5 max-w-[34ch] text-[0.9375rem] leading-snug text-(--on-ink-muted)">
            {unit.addressLine}
          </p>
        ) : null}
      </div>
    </Link>
  )
}
