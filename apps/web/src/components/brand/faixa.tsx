import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { SeletorIdioma } from '@/components/idioma/seletor-idioma'
import { dicionario } from '@/i18n'
import type { Idioma } from '@/i18n/tipos'
import { cn } from '@/lib/utils'

/**
 * A faixa de tinta do topo — a placa da porta.
 *
 * É a única coisa presente em todas as telas do lado da cliente: a montra, os
 * quatro passos da marcação, a porta da conta e a conta. Existe para que seja
 * tudo o mesmo sítio. Antes, marcar tinha faixa e a conta não tinha nada, e a
 * cliente atravessava uma fronteira invisível a meio do próprio percurso — saía
 * de um produto e entrava noutro sem ter mudado de sítio.
 *
 * A largura vem de fora porque a faixa acompanha a coluna que está por baixo: o
 * logótipo alinhado com o conteúdo, e não com a beira do ecrã.
 *
 * O selector de língua é opcional de propósito. Esta faixa serve as telas da
 * cliente E a porta da equipa (`components/auth/porta.tsx` monta as duas), e a
 * gestão não se traduz — passar `idioma` é a forma de dizer "esta tela é da
 * cliente". Quem não passa, não mostra.
 */
export function FaixaDaMarca({
  largura,
  fim,
  abaixo,
  home = '/loja',
  idioma,
}: {
  /** Classe de largura da coluna sob a faixa, para alinhar o logótipo com ela. */
  largura: string
  /** O que fecha a linha à direita: o passo da marcação, o botão de sair. */
  fim?: React.ReactNode
  /** Colado ao fundo da faixa, de beira a beira — a régua de progresso. */
  abaixo?: React.ReactNode
  /**
   * Para onde vai a marca. A montra por omissão: é a cara pública do salão, e
   * nunca `/`, que para a equipa é o dia de trabalho e para a cliente seria
   * cair num pedido de senha a meio de uma marcação.
   */
  home?: string
  /** A língua em vigor. Presente só nas telas da cliente — ver acima. */
  idioma?: Idioma
}) {
  return (
    <header className="bg-(--surface-ink) text-(--on-ink)">
      <div className={cn('mx-auto flex w-full items-center gap-4 px-5 py-4 sm:px-8', largura)}>
        <Link href={home as never} className="shrink-0 rounded-plate">
          <Wordmark size="sm" align="left" />
        </Link>
        {idioma ? (
          <div className="ml-auto">
            <SeletorIdioma atual={idioma} rotulo={dicionario(idioma).chrome.idioma} />
          </div>
        ) : null}
        {fim ? <div className={cn('min-w-0', idioma ? 'ml-4' : 'ml-auto')}>{fim}</div> : null}
      </div>
      {abaixo}
    </header>
  )
}
