import { addDaysInZone } from '@studio/core'
import Link from 'next/link'
import { formatDateLong } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

/**
 * Andar no calendário — o comando principal de quem abre a agenda.
 *
 * A data é o rótulo entre as setas, e não uma linha de apoio debaixo do título
 * repetida depois dentro do seletor. É o mesmo desenho na agenda de uma loja e
 * na das lojas todas: dois ecrãs que fazem a mesma pergunta têm de a fazer com
 * o mesmo gesto, senão a pessoa aprende dois calendários.
 *
 * Encaixe e remarcação têm navegador próprio de propósito: ali não se anda no
 * ecrã, anda-se dentro de um formulário a meio, e o dia escolhido volta para o
 * mesmo sítio em vez de recarregar a tela.
 *
 * "hoje" só existe quando não é hoje: um botão que não faz nada é ruído com o
 * mesmo peso de um que faz. E as setas levam nome, porque sozinhas um leitor de
 * ecrã anuncia "seta para a esquerda", que não diz para onde ela leva.
 *
 * Alvo de 44px, que é o padrão da casa e não a exceção: quem anda de dia em dia
 * faz isso de pé, com a mão ocupada.
 *
 * E são duas filas até `sm`, não uma que se desdobra. Numa fila só, os quatro
 * comandos somam mais do que os 358px úteis de um telemóvel, e o que acontecia
 * não era transbordo limpo: a data por extenso ("segunda-feira, 17 de agosto")
 * partia em duas linhas por cima do seletor nativo de data, e a agenda abria com
 * o cabeçalho encavalitado. Em cima anda-se um dia de cada vez; em baixo salta-se
 * para longe e faz-se o que a tela permite. Duas perguntas, duas filas.
 */
export function NavegadorDeDia({
  base,
  date,
  today,
  acao,
  className,
}: {
  /** Endereço da tela sem consulta, ex. `/agenda` ou `/agenda/valongo`. */
  base: string
  date: string
  today: string
  /** O comando desta tela — "Encaixar" na agenda de uma loja, nada na das todas. */
  acao?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      <div className="flex min-w-0 items-center gap-2 sm:flex-none">
        <Link
          href={href(`${base}?d=${addDaysInZone(date, -1)}`)}
          aria-label="Dia anterior"
          className={cn(buttonVariants({ variant: 'outline' }), 'px-3')}
        >
          ←
        </Link>
        <span className="flex-1 text-center text-sm font-medium sm:flex-none sm:text-left">
          {formatDateLong(date)}
        </span>
        <Link
          href={href(`${base}?d=${addDaysInZone(date, 1)}`)}
          aria-label="Próximo dia"
          className={cn(buttonVariants({ variant: 'outline' }), 'px-3')}
        >
          →
        </Link>

        {date === today ? null : (
          <Link
            href={href(base)}
            className="text-muted hover:text-(--text-strong) flex min-h-11 shrink-0 items-center px-1 text-sm transition-colors"
          >
            hoje
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 sm:ml-auto">
        <form action={base} className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <label htmlFor="ir-para-dia" className="sr-only">
            Ir para uma data
          </label>
          <input
            id="ir-para-dia"
            type="date"
            name="d"
            defaultValue={date}
            className="rounded-plate h-11 min-w-0 flex-1 border border-(--border-subtle) bg-(--surface-raised) px-2 text-sm sm:flex-none"
          />
          <button className={cn(buttonVariants({ variant: 'outline' }), 'shrink-0')}>Ir</button>
        </form>

        {acao}
      </div>
    </div>
  )
}
