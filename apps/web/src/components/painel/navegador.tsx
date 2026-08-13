import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { deslocarVista, type Vista } from '@/lib/periodo'
import { cn, href } from '@/lib/utils'

/**
 * O navegador de período.
 *
 * Duas peças que andam sempre juntas: em que escala se está a olhar
 * (dia · semana · mês) e para que ponto do calendário. Antes só existia o
 * navegador de dia — `[←] quarta-feira, 5 de agosto [→]` — repetido em três
 * telas; a escala é nova, e é o que a profissional pediu para poder ver a
 * semana sem abrir sete vezes o mesmo ecrã.
 *
 * Tudo são ligações e não botões com estado: a vista e a data vivem no
 * endereço, então a página é partilhável, o botão de voltar do navegador faz o
 * que deve, e nada disto precisa de JavaScript.
 */
export function NavegadorPeriodo({
  base,
  vista,
  data,
  hoje,
  rotulo,
}: {
  /** Caminho da tela, sem parâmetros. */
  base: string
  vista: Vista
  data: string
  /** A data de hoje, para o atalho — quem sabe qual é, é o servidor. */
  hoje: string
  /** "quarta-feira, 5 de agosto", "4 – 10 de agosto", "Agosto de 2026". */
  rotulo: string
}) {
  const ligacao = (v: Vista, d: string) => href(`${base}?v=${v}&d=${d}`)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {/* ── a escala ──────────────────────────────────────────────────────── */}
      <div
        role="group"
        aria-label="Escala"
        className="rounded-plate flex items-center border border-(--border-strong) p-0.5"
      >
        {(['dia', 'semana', 'mes'] as const).map((item) => {
          const activa = item === vista
          return (
            <Link
              key={item}
              href={ligacao(item, data)}
              aria-current={activa ? 'true' : undefined}
              className={cn(
                'rounded-plate flex min-h-9 items-center px-3 text-sm transition-colors',
                activa
                  ? 'bg-(--surface-invert) font-medium text-(--on-invert)'
                  : 'text-(--text-body) hover:bg-(--surface-sunken)',
              )}
            >
              {item === 'mes' ? 'Mês' : item === 'dia' ? 'Dia' : 'Semana'}
            </Link>
          )
        })}
      </div>

      {/* ── o ponto do calendário ─────────────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-1">
        <Seta
          para={ligacao(vista, deslocarVista(vista, data, -1))}
          rotulo="Período anterior"
          lado="esquerda"
        />
        <p className="min-w-0 flex-1 px-2 text-center text-sm font-medium first-letter:uppercase sm:text-left">
          {rotulo}
        </p>
        <Seta
          para={ligacao(vista, deslocarVista(vista, data, 1))}
          rotulo="Período seguinte"
          lado="direita"
        />
      </div>

      {/* Só aparece quando já se saiu de hoje: um botão que não faz nada é um
          botão que ensina a ignorar a barra. */}
      {data !== hoje ? (
        <Link
          href={ligacao(vista, hoje)}
          className="rounded-plate flex min-h-9 items-center border border-(--border-strong) px-3 text-sm text-(--text-body) transition-colors hover:bg-(--surface-sunken)"
        >
          Hoje
        </Link>
      ) : null}
    </div>
  )
}

function Seta({
  para,
  rotulo,
  lado,
}: {
  para: ReturnType<typeof href>
  rotulo: string
  lado: 'esquerda' | 'direita'
}) {
  return (
    <Link
      href={para}
      aria-label={rotulo}
      className="rounded-plate grid size-9 shrink-0 place-items-center text-(--text-body) transition-colors hover:bg-(--surface-sunken)"
    >
      {lado === 'esquerda' ? (
        <ChevronLeft className="size-4" strokeWidth={2} />
      ) : (
        <ChevronRight className="size-4" strokeWidth={2} />
      )}
    </Link>
  )
}
