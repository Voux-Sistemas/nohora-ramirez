import { cn } from '@/lib/utils'

/*
  A marca em código.

  O arquivo que a dona entregou é um JPG de fundo branco (`/marca/nohora-ramirez.jpg`),
  que não serve para interface: não escala, não vira claro sobre fundo escuro e
  carrega um retângulo branco atrás. Enquanto o SVG oficial não chega, a marca é
  remontada aqui a partir dos seus três elementos, na mesma proporção do
  original: coroa botânica, monograma NR e o logotipo em duas linhas.

  A coroa é desenho próprio — anel de folhas finas com abertura à direita, no
  ponto exato onde o swash do monograma atravessa e rompe o círculo. É o gesto
  mais distintivo da identidade e vira a assinatura gráfica do sistema.
*/

const WREATH_STEM = 'M 164.66 143.62 A 78 78 0 1 1 154.18 43.89'

const WREATH_LEAVES =
  'M 164.66 143.62 Q 162.6 143.24 160.74 145.2 Q 163.44 145.33 164.66 143.62 M 159.68 150.23 Q 158.26 152.01 159.19 154.79 Q 160.68 152.27 159.68 150.23 M 154.01 156.27 Q 151.75 155.33 149.15 157.11 Q 152.19 157.92 154.01 156.27 M 147.74 161.68 Q 145.71 163.35 146.09 166.7 Q 148.38 164.23 147.74 161.68 M 140.93 166.4 Q 138.63 164.81 135.31 166.17 Q 138.51 167.8 140.93 166.4 M 133.66 170.36 Q 131.02 171.72 130.64 175.5 Q 133.76 173.33 133.66 170.36 M 126.01 173.54 Q 123.87 171.25 119.92 171.96 Q 123.03 174.49 126.01 173.54 M 118.06 175.88 Q 114.89 176.73 113.59 180.74 Q 117.48 179.11 118.06 175.88 M 109.92 177.37 Q 108.15 174.42 103.74 174.26 Q 106.5 177.71 109.92 177.37 M 101.66 177.98 Q 98.08 178.16 95.77 182.14 Q 100.29 181.3 101.66 177.98 M 93.38 177.72 Q 92.18 174.19 87.55 173.02 Q 89.68 177.3 93.38 177.72 M 85.18 176.58 Q 81.37 175.95 78.04 179.62 Q 82.98 179.75 85.18 176.58 M 77.14 174.57 Q 76.68 170.62 72.1 168.35 Q 73.37 173.3 77.14 174.57 M 69.36 171.73 Q 65.55 170.23 61.27 173.28 Q 66.37 174.53 69.36 171.73 M 61.93 168.08 Q 62.33 163.89 58.12 160.53 Q 58.32 165.92 61.93 168.08 M 54.92 163.66 Q 51.34 161.27 46.28 163.46 Q 51.24 165.87 54.92 163.66 M 48.43 158.52 Q 49.76 154.34 46.2 149.98 Q 45.22 155.52 48.43 158.52 M 42.51 152.72 Q 39.4 149.52 33.79 150.63 Q 38.29 154.16 42.51 152.72 M 37.25 146.32 Q 39.5 142.4 36.86 137.23 Q 34.67 142.61 37.25 146.32 M 32.69 139.41 Q 30.26 135.53 24.39 135.42 Q 28.14 139.94 32.69 139.41 M 28.89 132.05 Q 31.98 128.62 30.46 122.89 Q 27.11 127.79 28.89 132.05 M 25.89 124.33 Q 24.31 119.96 18.5 118.59 Q 21.26 123.88 25.89 124.33 M 23.73 116.33 Q 27.52 113.61 27.23 107.62 Q 22.88 111.74 23.73 116.33 M 22.43 108.15 Q 21.8 103.52 16.39 100.95 Q 17.97 106.74 22.43 108.15 M 22 99.88 Q 26.28 98.02 27.26 92.11 Q 22.14 95.22 22 99.88 M 22.45 91.61 Q 22.82 86.98 18.09 83.34 Q 18.42 89.3 22.45 91.61 M 23.78 83.44 Q 28.31 82.52 30.49 77.01 Q 24.89 78.95 23.78 83.44 M 25.97 75.45 Q 27.28 71.06 23.48 66.58 Q 22.56 72.38 25.97 75.45 M 28.99 67.73 Q 33.51 67.8 36.74 62.97 Q 30.98 63.67 28.99 67.73 M 32.81 60.39 Q 34.96 56.48 32.26 51.43 Q 30.2 56.77 32.81 60.39 M 37.39 53.48 Q 41.66 54.47 45.71 50.56 Q 40.1 50.04 37.39 53.48 M 42.67 47.11 Q 45.5 43.87 43.98 38.56 Q 40.95 43.17 42.67 47.11 M 48.6 41.33 Q 52.41 43.11 56.99 40.27 Q 51.84 38.65 48.6 41.33 M 55.12 36.21 Q 58.4 33.75 58.05 28.51 Q 54.3 32.19 55.12 36.21 M 62.13 31.81 Q 65.3 34.22 70.11 32.5 Q 65.67 29.98 62.13 31.81 M 69.58 28.18 Q 73.08 26.57 73.81 21.67 Q 69.62 24.32 69.58 28.18 M 77.36 25.36 Q 79.79 28.19 84.53 27.56 Q 80.96 24.38 77.36 25.36 M 85.41 23.38 Q 88.91 22.6 90.53 18.3 Q 86.21 19.88 85.41 23.38 M 93.61 22.26 Q 95.25 25.29 99.65 25.65 Q 97.05 22.08 93.61 22.26 M 101.89 22.02 Q 105.18 22.01 107.46 18.46 Q 103.28 19.05 101.89 22.02 M 110.15 22.66 Q 111.02 25.67 114.86 26.83 Q 113.24 23.16 110.15 22.66 M 118.3 24.18 Q 121.19 24.79 123.88 22.09 Q 120.09 21.82 118.3 24.18 M 126.23 26.54 Q 126.43 29.33 129.57 31.07 Q 128.84 27.56 126.23 26.54 M 133.87 29.74 Q 136.27 30.81 139.1 28.98 Q 135.87 28.03 133.87 29.74 M 141.13 33.73 Q 140.78 36.16 143.15 38.23 Q 143.18 35.08 141.13 33.73 M 147.93 38.46 Q 149.77 39.81 152.5 38.78 Q 149.93 37.38 147.93 38.46 M 154.18 43.89 Q 153.45 45.86 155.06 48.03 Q 155.65 45.4 154.18 43.89'

/** O swash que nasce no N, passa por baixo do R e rompe o círculo. */
const SWASH = 'M 60 52 C 96 84 128 122 168 146'

export const COROA_ID = 'nr-coroa'

/**
 * A coroa entra no documento uma vez, e as outras apontam para ela.
 *
 * As 78 folhas são 1,8 kB de `d=` — barato uma vez, caro sessenta e sete. Cada
 * serviço sem fotografia usa a coroa de fundo na placa, e a lista de Valongo
 * tem sessenta e sete serviços: a tela de marcação chegava ao telemóvel da
 * cliente com 377 kB, dos quais 240 kB eram a mesma corrente de curvas repetida
 * 134 vezes, para 2,3 kB de texto legível. Com `<use>` a repetição passa a
 * custar quarenta bytes.
 *
 * Fica no `<body>` do layout, antes de tudo: `<use>` só resolve o que já está
 * no documento, e o fragmento tem de existir antes da primeira placa pintar.
 */
export function CoroaDefinicao() {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <g id={COROA_ID}>
          <path d={WREATH_STEM} stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <path d={WREATH_LEAVES} stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
        </g>
      </defs>
    </svg>
  )
}

/**
 * A coroa botânica sozinha. `drawn` liga o desenho do traço — usado uma única
 * vez no fluxo, na tela de confirmação, e é o único caso que ainda desenha os
 * caminhos inteiros: a animação precisa de agarrar cada traço pela sua classe,
 * e conteúdo referenciado por `<use>` não se alcança pelo CSS da página.
 */
export function Wreath({ className, drawn = false }: { className?: string; drawn?: boolean }) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
      className={cn('h-full w-full', className)}
    >
      {drawn ? (
        <>
          <path
            d={WREATH_STEM}
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            className="seal-stem"
          />
          <path
            d={WREATH_LEAVES}
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinejoin="round"
            className="seal-leaves"
          />
        </>
      ) : (
        <use href={`#${COROA_ID}`} />
      )}
    </svg>
  )
}

/**
 * Monograma completo: coroa + NR. O NR é texto de verdade em Bodoni, não
 * caminho vetorial — assim herda a mesma fonte do resto da identidade e
 * continua nítido em qualquer tamanho.
 *
 * As letras moram dentro do mesmo viewBox da coroa, e não numa camada de HTML
 * por cima. Em `em` elas se mediam pelo texto ao redor, não pela marca: na
 * barra da operação, um monograma de 32px herdava corpo 15 e desenhava um "NR"
 * de 51px, que vazava por cima do logotipo. Em unidade de viewBox a proporção
 * é a mesma em qualquer tamanho, que é o mínimo que se espera de uma marca.
 */
export function Monogram({
  className,
  drawn = false,
  label = 'Nohora Ramirez Beauty Studio',
}: {
  className?: string
  drawn?: boolean
  label?: string
}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('relative inline-block aspect-square', className)}
    >
      <Wreath drawn={drawn} className="text-current opacity-70" />
      <svg
        viewBox="0 0 200 200"
        fill="none"
        aria-hidden
        className="absolute inset-0 h-full w-full"
      >
        <path
          d={SWASH}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.85"
          className={drawn ? 'seal-swash' : undefined}
        />
        <text
          x="100"
          y="123"
          textAnchor="middle"
          fill="currentColor"
          fontSize="66"
          className={cn('display', drawn && 'seal-letters')}
        >
          NR
        </text>
      </svg>
    </span>
  )
}

/**
 * Logotipo em duas linhas, na proporção do arquivo original: o nome em serifa
 * caixa-alta com tracking aberto, e a descrição em grotesca caixa-alta com
 * tracking bem mais largo.
 *
 * Exceção deliberada à regra "Bodoni só ≥ 28px": caixa-alta com tracking aberto
 * não tem detalhe frágil de minúscula, então a hairline aguenta 17px. Abaixo
 * disso o logotipo não é usado — usa-se o monograma.
 */
export function Wordmark({
  className,
  size = 'md',
  align = 'center',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  align?: 'center' | 'left'
}) {
  const name = {
    sm: 'text-[1.0625rem]',
    md: 'text-[1.375rem] sm:text-[1.5rem]',
    lg: 'text-[1.75rem] sm:text-[2.25rem]',
  }[size]

  const tag = {
    sm: 'text-[0.5rem]',
    md: 'text-[0.5625rem]',
    lg: 'text-[0.6875rem]',
  }[size]

  return (
    <span
      className={cn(
        'inline-flex flex-col',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
    >
      <span
        className={cn(
          'display font-normal uppercase',
          name,
          size === 'lg' ? 'tracking-[0.09em]' : 'tracking-[0.07em]',
        )}
      >
        Nohora Ramirez
      </span>
      <span className={cn('mt-[0.45em] font-semibold uppercase tracking-[0.42em]', tag)}>
        <span className="opacity-70">Beauty&nbsp;Studio</span>
      </span>
    </span>
  )
}
