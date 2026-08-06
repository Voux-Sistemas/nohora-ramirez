import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { cn } from '@/lib/utils'

const STEPS = ['Unidade', 'Serviços', 'Horário', 'Confirmar'] as const

/**
 * Casca das telas de agendamento.
 *
 * A faixa de tinta no topo é a placa da porta: a cliente sabe de quem é a
 * agenda antes de ler qualquer coisa. Abaixo dela, um fio de bronze que avança
 * — o progresso é uma régua que enche, não quatro bolinhas numeradas. Bolinha
 * numerada informa exatamente a mesma coisa e faz o produto parecer formulário
 * de banco; a promessa aqui é escolher pessoa, hora e lugar.
 *
 * O rodapé é pedra clara, não tinta: a ação principal é um botão de tinta, e
 * tinta sobre tinta não existe.
 */
export function BookingShell({
  step,
  title,
  subtitle,
  back,
  backLabel = 'Voltar',
  width = 'narrow',
  children,
  footer,
}: {
  step: 1 | 2 | 3 | 4
  title: string
  subtitle?: string
  /** Href do passo anterior. Ausente no primeiro. */
  back?: string
  backLabel?: string
  /** `wide` para as telas que mostram fotografia em grade. */
  width?: 'narrow' | 'wide'
  children: React.ReactNode
  /** Barra fixa no rodapé — é onde mora a ação principal. */
  footer?: React.ReactNode
}) {
  const shell = width === 'wide' ? 'max-w-5xl' : 'max-w-2xl'
  const pct = (step / STEPS.length) * 100

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-(--surface-ink) text-(--on-ink)">
        <div className={cn('mx-auto flex w-full items-center gap-4 px-5 py-4 sm:px-8', shell)}>
          <Link href="/" className="shrink-0 rounded-plate">
            <Wordmark size="sm" align="left" />
          </Link>
          <span className="label-caps tnum ml-auto text-right text-(--on-ink-muted)">
            <span className="text-(--on-ink)">{step}</span> de {STEPS.length}
            <span className="hidden sm:inline"> · {STEPS[step - 1]}</span>
          </span>
        </div>

        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step}
          aria-valuetext={`Passo ${step} de ${STEPS.length}: ${STEPS[step - 1]}`}
          className="h-px w-full bg-(--border-on-ink)"
        >
          <div
            className="h-full bg-(--accent) transition-[width] duration-700 ease-(--ease-out-quint)"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <main className={cn('mx-auto w-full flex-1 px-5 pt-7 pb-36 sm:px-8 sm:pt-12', shell)}>
        {back ? (
          <Link
            href={back as never}
            className="text-muted mb-5 inline-flex items-center gap-1.5 text-sm transition-colors hover:text-(--text-strong)"
          >
            <span aria-hidden>←</span>
            {backLabel}
          </Link>
        ) : null}

        <h1 className="display display-lg">{title}</h1>
        {subtitle ? <p className="text-body measure mt-3 text-[1.0625rem]">{subtitle}</p> : null}

        <div className="mt-9 sm:mt-11">{children}</div>
      </main>

      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-(--border-subtle) bg-(--surface-raised)/95 shadow-(--shadow-lift) backdrop-blur-md">
          <div className={cn('mx-auto w-full px-5 py-3 sm:px-8', shell)}>{footer}</div>
        </div>
      ) : null}
    </div>
  )
}
