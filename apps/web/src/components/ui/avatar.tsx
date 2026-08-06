import { cn } from '@/lib/utils'

/*
  Avatar da equipe.

  Deliberadamente sem foto de banco de imagem. Colocar o retrato de um
  desconhecido embaixo do nome de uma profissional real, numa tela que a cliente
  usa para escolher quem vai encostar no cabelo dela, é a fabricação mais cara
  que este produto poderia cometer — e o salão que comprar o sistema herdaria a
  mentira. Quando as fotos reais da equipe chegarem, elas entram por
  `staff_profiles.avatar_url` e este componente passa a mostrá-las.

  Até lá: iniciais em Bodoni sobre um banho da cor da profissional. A cor já
  existe no sistema (é a cor dela na agenda), então o avatar reforça um código
  que a recepção já conhece. O banho é calculado contra a própria superfície, o
  que mantém o contraste do texto alto seja qual for o matiz cadastrado.
*/

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '·'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const SIZES = {
  sm: 'h-9 w-9 text-[0.8125rem]',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
} as const

export function Avatar({
  name,
  color,
  src,
  size = 'md',
  className,
}: {
  name: string
  /** Cor da profissional na agenda. */
  color?: string | null
  /** Retrato real, quando o salão tiver subido. */
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const tint = color
    ? `color-mix(in oklab, ${color} 18%, var(--surface-raised))`
    : 'var(--surface-sunken)'

  return (
    <span
      role="img"
      aria-label={name}
      style={
        src
          ? { backgroundImage: `url(${src})`, backgroundSize: 'cover' }
          : { backgroundColor: tint }
      }
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded-full bg-center',
        'ring-1 ring-(--border-subtle) ring-inset',
        SIZES[size],
        className,
      )}
    >
      {/* Iniciais em Archivo, não em Bodoni: 13px de didone é hairline que some.
          A serifa da marca fica reservada ao display e ao monograma. */}
      {src ? null : (
        <span aria-hidden className="leading-none font-semibold tracking-[0.06em]">
          {initials(name)}
        </span>
      )}
    </span>
  )
}
