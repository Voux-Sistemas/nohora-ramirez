import Image from 'next/image'
import { Wreath } from '@/components/brand/mark'
import { cn } from '@/lib/utils'

/*
  Fotografia com estado vazio desenhado.

  A ausência de foto não é uma falha a esconder: é o estado inicial de todo
  salão que acabou de entrar no sistema, e o serviço que não fotografa bem
  (escova, retoque de raiz) fica melhor sem foto do que com foto genérica de
  banco de imagem. Por isso a placa vazia é desenho, não um retângulo cinza
  com ícone de montanha — ela usa a coroa da marca e as iniciais, e continua
  reconhecível como Nohora Ramirez.

  Consequência de projeto: a grade nunca precisa de foto em todo item para
  ficar boa. Quatro serviços do catálogo estão sem foto de propósito, e a
  tela é revisada nesse estado.
*/

/** Duas letras a partir do nome — "Coloração Global" vira "CG", "Botox" vira "B". */
function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÀ-Ý]/u.test(w))
  if (words.length === 0) return '·'
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase()
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase()
}

/**
 * Deslocamento estável da coroa por nome. Sem isso, uma grade de placas vazias
 * vira padrão de papel de parede — todas idênticas, alinhadas, óbvias.
 */
function drift(seed: string): { x: number; y: number; scale: number } {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const a = Math.abs(h)
  return {
    x: ((a % 17) - 8) * 1.5,
    y: (((a >> 5) % 13) - 6) * 1.5,
    scale: 1.05 + ((a >> 9) % 7) / 40,
  }
}

export type PhotoProps = {
  src: string | null | undefined
  alt: string
  /** Semente da placa vazia: normalmente o mesmo nome que está no alt. */
  name: string
  className?: string
  /** Repassado ao `sizes` do next/image. Obrigatório pensar, não copiar. */
  sizes: string
  priority?: boolean
  /** Zoom lento no hover — só onde o bloco inteiro é clicável. */
  interactive?: boolean
}

export function Photo({
  src,
  alt,
  name,
  className,
  sizes,
  priority = false,
  interactive = false,
}: PhotoProps) {
  if (!src) return <PhotoPlate name={name} className={className} />

  return (
    <div className={cn('relative overflow-hidden bg-(--surface-sunken)', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          'object-cover',
          interactive &&
            'transition-transform duration-700 ease-(--ease-out-quint) group-hover:scale-[1.04]',
        )}
      />
    </div>
  )
}

/**
 * A placa vazia, exportada à parte porque também serve de moldura para o
 * campo de upload — o que a cliente vê antes de escolher o arquivo é
 * exatamente o que ela verá se não escolher nenhum.
 */
function PhotoPlate({
  name,
  className,
  children,
}: {
  name: string
  className?: string
  children?: React.ReactNode
}) {
  const { x, y, scale } = drift(name)

  return (
    <div
      className={cn(
        // `@container`: as iniciais escalam com a placa, não com a janela — a
        // mesma placa serve de miniatura de 64px e de capa de 480px.
        //
        // Tinta, não pedra. Cinza claro sobre bege claro lê como "a imagem não
        // carregou"; tinta com coroa de bronze lê como decisão. É a diferença
        // entre um buraco e um selo, e o item sem foto fica na mesma fileira
        // que os com foto sem parecer o que sobrou.
        '@container relative overflow-hidden bg-(--surface-ink) text-(--on-ink-accent)',
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 grid place-items-center opacity-30"
        style={{ transform: `translate(${x}%, ${y}%) scale(${scale})` }}
      >
        <Wreath className="h-[78%] w-[78%]" />
      </div>
      <div
        aria-hidden
        // piso em 28px: abaixo disso a hairline da Bodoni desaparece
        className="display absolute inset-0 grid place-items-center text-[clamp(1.75rem,10cqw,2.75rem)] tracking-[0.08em]"
      >
        {initials(name)}
      </div>
      {children}
    </div>
  )
}
