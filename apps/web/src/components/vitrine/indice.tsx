'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'

/**
 * A espinha da página da casa.
 *
 * A queixa da reunião foi "a página está cansativa de ler, muita coisa", e a
 * causa não era o texto: era não haver forma de saltar. A montra de Valongo tem
 * sessenta e sete linhas de preçário, e quem chegava com uma pergunta — quanto
 * custa uma coloração, a que horas fecha — tinha de rolar a página inteira à
 * procura dela. Uma página comprida não cansa; uma página comprida sem mapa,
 * sim.
 *
 * Esta barra é o mapa, e cola-se ao topo porque um mapa que sai do ecrã deixa
 * de o ser. Leva também o botão de marcar, e por isso é a ÚNICA barra colada da
 * montra: o cabeçalho de cima continua a rolar para fora como qualquer outro
 * conteúdo. Duas barras coladas uma por baixo da outra obrigam a fixar a altura
 * de uma na outra, e qualquer mudança de tipografia numa passa a partir o
 * alinhamento da outra em silêncio.
 *
 * A secção onde se está leva a régua de bronze — a mesma marca que assinala a
 * casa aberta nos separadores do cabeçalho e a secção activa na barra da
 * equipa. É o mesmo gesto em três sítios: dizer onde se está sem gritar.
 *
 * Sem JavaScript continua a ser o que já era antes de acender: uma lista de
 * âncoras que salta para o sítio certo. O que se perde é o realce, e o realce
 * é conforto, não navegação.
 */
export function IndiceDaCasa({
  seccoes,
  marcar,
  textos,
}: {
  seccoes: readonly { id: string; rotulo: string }[]
  /** Caminho da marcação desta casa. */
  marcar: string
  /** Os rótulos das secções já vêm traduzidos dentro de `seccoes`. */
  textos: { nestaCasa: string; marcar: string }
}) {
  const activa = useSeccaoVisivel(seccoes)

  if (seccoes.length === 0) return null

  return (
    <nav
      aria-label={textos.nestaCasa}
      className="sticky top-0 z-(--z-sticky) border-b border-(--border-on-ink) bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]"
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-x-3 px-5 sm:px-8">
        <ul className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {seccoes.map((seccao) => {
            const aqui = seccao.id === activa
            return (
              <li key={seccao.id} className="shrink-0">
                <a
                  href={`#${seccao.id}`}
                  aria-current={aqui ? 'true' : undefined}
                  className={cn(
                    'rounded-plate relative flex min-h-12 items-center px-2 text-sm whitespace-nowrap transition-colors sm:px-3',
                    aqui ? 'text-(--on-ink)' : 'text-(--on-ink-muted) hover:text-(--on-ink)',
                  )}
                >
                  {seccao.rotulo}
                  {aqui ? (
                    <span
                      aria-hidden
                      className="absolute inset-x-2 bottom-2 h-px bg-(--on-ink-accent)"
                    />
                  ) : null}
                </a>
              </li>
            )
          })}
        </ul>

        <Link
          href={href(marcar)}
          className={cn(buttonVariants({ variant: 'on-ink', size: 'sm' }), 'my-2 shrink-0')}
        >
          {textos.marcar}
        </Link>
      </div>
    </nav>
  )
}

/**
 * Qual das secções está debaixo do olhar.
 *
 * A faixa de decisão é uma tira estreita a um terço da altura do ecrã, e não o
 * ecrã inteiro: com o ecrã inteiro, uma secção alta e outra baixa ficam visíveis
 * ao mesmo tempo e o realce salta entre as duas a cada pixel de rolagem. Com a
 * tira, há sempre uma resposta só, e ela muda quando o título da seguinte passa
 * pela linha em que uma pessoa realmente está a ler.
 *
 * Quando nenhuma secção cruza a tira — no fim da página, ou num intervalo entre
 * blocos — fica a última. Apagar o realce nesse instante seria dizer "não está
 * em lado nenhum", que é falso e pisca.
 */
function useSeccaoVisivel(seccoes: readonly { id: string }[]): string | null {
  const [activa, setActiva] = useState<string | null>(null)
  const chave = seccoes.map((s) => s.id).join('|')

  useEffect(() => {
    const ids = chave ? chave.split('|') : []
    const alvos = ids.map((id) => document.getElementById(id)).filter((e) => e !== null)
    if (alvos.length === 0) return

    const observador = new IntersectionObserver(
      (entradas) => {
        const dentro = entradas.find((e) => e.isIntersecting)
        if (dentro) setActiva(dentro.target.id)
      },
      { rootMargin: '-32% 0px -60% 0px' },
    )

    for (const alvo of alvos) observador.observe(alvo)
    return () => observador.disconnect()
  }, [chave])

  return activa
}
