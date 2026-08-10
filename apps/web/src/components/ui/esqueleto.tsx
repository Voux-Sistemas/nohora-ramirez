import { cn } from '@/lib/utils'

/**
 * O desenho da tela antes dos dados.
 *
 * A agenda de um dia cheio é meia dúzia de consultas ao Postgres; entre o
 * clique e a resposta a tela ficava exatamente igual à anterior, e a recepção
 * clicava de novo achando que não tinha pego. O esqueleto não deixa a espera
 * mais curta — deixa ela visível, que é o que faz ninguém clicar duas vezes.
 *
 * É pedra afundada, não cinza genérico: a espera acontece dentro do mesmo
 * mundo do resto. E respira devagar, porque um pulso rápido numa tela que a
 * recepção olha o dia inteiro cansa.
 */
export function Barra({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className={cn(
        'animate-pulse rounded-plate bg-(--surface-sunken) [animation-duration:1.8s]',
        'motion-reduce:animate-none',
        className,
      )}
    />
  )
}

/** Cabeçalho de seção: título largo e uma linha de apoio. */
export function CabecalhoFalso() {
  return (
    <div className="flex flex-col gap-3">
      <Barra className="h-8 w-56" />
      <Barra className="h-4 w-36" />
    </div>
  )
}

/**
 * Pauta de linhas — a forma que quase toda tela da operação tem: unidades no
 * início do dia, clientes na busca, lançamentos do caixa.
 */
export function PautaFalsa({ linhas = 6 }: { linhas?: number }) {
  return (
    <div className="mt-7 border-t border-(--border-strong)">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-(--border-subtle) py-4">
          <Barra className="aspect-square w-12 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Barra className="h-4 w-40 max-w-[60%]" />
            <Barra className="h-3 w-24 max-w-[35%]" />
          </div>
          <Barra className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/** Aviso para leitor de tela: o resto é decoração e fica escondido dele. */
export function Carregando({ children }: { children: React.ReactNode }) {
  return (
    <main
      aria-busy="true"
      className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10"
    >
      <span className="sr-only" role="status">
        Carregando…
      </span>
      <div aria-hidden>{children}</div>
    </main>
  )
}
