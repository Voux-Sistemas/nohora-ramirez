import Link from 'next/link'
import { FaixaDaMarca } from '@/components/brand/faixa'
import { EmTransito, Entrada } from '@/components/ui/espera'
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
 *
 * `rail`: no celular o passo continua uma coluna só — é o desenho que já
 * funciona com o polegar. A partir de `lg` sobra largura de verdade, e uma
 * tela de decisão com uma coluna de 672px cercada de nada não é "adaptada
 * para computador", é a tela do celular esticada. O rail é onde mora o que
 * ancora a decisão em telas grandes — a casa em fotografia, o que já foi
 * escolhido — fixo enquanto a coluna principal rola.
 */
export function BookingShell({
  step,
  title,
  subtitle,
  back,
  backLabel = 'Voltar',
  width = 'narrow',
  rail,
  railFirst = false,
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
  /** Coluna de contexto, só a partir de `lg`. Ignorada com `width="wide"`. */
  rail?: React.ReactNode
  /**
   * No celular o rail nasce depois do conteúdo — é apoio, não a decisão. A
   * confirmação inverte: ali o rail é o extrato que a cliente precisa ver
   * antes de datilografar o telefone, então ele vem primeiro nos dois tamanhos.
   */
  railFirst?: boolean
  children: React.ReactNode
  /** Barra fixa no rodapé — é onde mora a ação principal. */
  footer?: React.ReactNode
}) {
  const shell = width === 'wide' ? 'max-w-5xl' : 'max-w-2xl'
  const hasRail = Boolean(rail) && width !== 'wide'
  const outer = hasRail ? 'max-w-[68rem]' : shell
  const pct = (step / STEPS.length) * 100

  const body = (
    <>
      {back ? (
        <Link
          href={back as never}
          className="text-muted mb-5 inline-flex items-center gap-1.5 text-sm transition-colors hover:text-(--text-strong)"
        >
          <EmTransito />
          <span aria-hidden>←</span>
          {backLabel}
        </Link>
      ) : null}

      <h1 className="display display-lg">{title}</h1>
      {subtitle ? <p className="text-body measure mt-3 text-[1.0625rem]">{subtitle}</p> : null}

      <div className="mt-9 sm:mt-11">{children}</div>
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col">
      {/* A marca leva à montra e não a `/` — `/` é o dia da equipa, e o
          logótipo do salão não pode levar a cliente a um formulário de senha no
          meio da marcação. É o valor por omissão da faixa. */}
      <FaixaDaMarca
        largura={outer}
        fim={
          <span className="label-caps tnum block text-right text-(--on-ink-muted)">
            <span className="text-(--on-ink)">{step}</span> de {STEPS.length}
            <span className="hidden sm:inline"> · {STEPS[step - 1]}</span>
          </span>
        }
        abaixo={
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
        }
      />

      <main
        className={cn(
          'mx-auto w-full flex-1 px-5 pt-7 sm:px-8 sm:pt-12',
          /*
            A folga do fim existe por causa do rodapé fixo, então ela só existe
            quando há rodapé. Fixa em todas as telas, era meio ecrã de rolagem
            para nada no telemóvel — e num passo sem rodapé o polegar chegava ao
            fim da lista e continuava a rolar sobre o vazio, que se lê como
            "acabou de carregar" e não como "acabou".

            Com rail, a partir de `lg` o rodapé sai da tela (ver abaixo) e a
            folga sai com ele.
          */
          footer ? 'pb-[calc(5rem+env(safe-area-inset-bottom))]' : 'pb-12 sm:pb-16',
          footer && hasRail && 'lg:pb-16',
          outer,
        )}
      >
        <Entrada>
          {hasRail ? (
            <div className="flex flex-col gap-10 lg:grid lg:grid-cols-[1fr_22rem] lg:items-start lg:gap-16">
              <div className={cn('mx-auto w-full', shell, 'lg:mx-0', railFirst && 'order-2 lg:order-1')}>
                {body}
              </div>
              <aside className={cn('lg:sticky lg:top-28', railFirst && 'order-1 lg:order-2')}>{rail}</aside>
            </div>
          ) : (
            body
          )}
        </Entrada>
      </main>

      {footer ? (
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-(--border-subtle) bg-(--surface-raised)/95 shadow-(--shadow-lift) backdrop-blur-md',
            // Com rail, o rodapé é o resumo de quem não vê a coluna lateral —
            // a partir de `lg` o rail já mostra o mesmo, e duplicar era ruído.
            hasRail && 'lg:hidden',
          )}
        >
          {/* `env(safe-area-inset-bottom)`: no iPhone o rodapé encostado em
              `bottom-0` nasce debaixo da barra de gestos, e o preço da marcação
              fica cortado ao meio pela risca branca do sistema. */}
          <div
            className={cn(
              'mx-auto w-full px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8',
              outer,
            )}
          >
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  )
}
