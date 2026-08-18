import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { listUnits } from '@/server/scheduling/context'

/**
 * A placa da porta do lado da rua — e o corredor entre as duas casas.
 *
 * A montra de Valongo não sabia que a Maia existia. Quem chegava por um link do
 * Instagram via uma casa, e para ver a outra tinha de escrever o endereço à mão
 * ou voltar ao perfil. Duas montras sem porta entre elas são dois salões, e o
 * salão é um.
 *
 * As casas ficam aqui em cima e não numa secção lá em baixo por uma razão de
 * leitura: "há outra casa" é informação de orientação, e orientação lê-se antes
 * de se rolar, não depois. A que está aberta leva a régua de bronze — a mesma
 * marca de secção activa da barra da equipa, porque é o mesmo gesto: dizer onde
 * se está sem gritar.
 *
 * O logótipo leva ao painel das duas, que é a casa da marca. Nunca a `/`, que
 * é o dia de trabalho da equipa e para a cliente seria um pedido de senha.
 */
export async function CabecalhoPublico({
  atual,
  marcar = '/agendar',
}: {
  /** Slug da casa que está aberta. Ausente no painel da rede. */
  atual?: string
  /** Onde carrega o botão — a marcação desta casa, ou a escolha de casa. */
  marcar?: string
}) {
  const lojas = await listUnits()

  return (
    <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      {/*
        Duas filas no telemóvel, uma a partir de `sm` — o mesmo arranjo da barra
        da equipa e pela mesma razão: o logótipo e o botão de marcar não encolhem,
        e num ecrã de 390px os nomes das casas ficariam por baixo do logótipo.
      */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 sm:flex-nowrap sm:px-8">
        <Link href={href('/loja')} className="rounded-plate order-1 shrink-0">
          <Wordmark size="sm" align="left" />
        </Link>

        {lojas.length > 1 ? (
          <nav
            aria-label="As nossas casas"
            className="-mb-1 order-3 flex w-full items-stretch gap-1 overflow-x-auto sm:order-2 sm:ml-auto sm:w-auto"
          >
            {lojas.map((loja) => {
              const aberta = loja.slug === atual
              return (
                <Link
                  key={loja.id}
                  href={href(`/loja/${loja.slug}`)}
                  aria-current={aberta ? 'page' : undefined}
                  className={cn(
                    'rounded-plate relative flex min-h-10 shrink-0 items-center px-2 text-sm whitespace-nowrap transition-colors sm:min-h-11 sm:px-3',
                    aberta
                      ? 'text-(--on-ink)'
                      : 'text-(--on-ink-muted) hover:text-(--on-ink)',
                  )}
                >
                  {loja.name}
                  {aberta ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-2 bottom-1 h-px bg-(--on-ink-accent)"
                    />
                  ) : null}
                </Link>
              )
            })}
          </nav>
        ) : null}

        <Link
          href={href(marcar)}
          className={cn(
            buttonVariants({ variant: 'on-ink', size: 'sm' }),
            'order-2 ml-auto shrink-0 sm:order-3 sm:ml-4',
          )}
        >
          Marcar
        </Link>
      </div>
    </header>
  )
}
