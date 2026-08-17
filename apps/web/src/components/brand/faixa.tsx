import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
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
 */
export function FaixaDaMarca({
  largura,
  fim,
  abaixo,
  home = '/loja',
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
}) {
  return (
    <header className="bg-(--surface-ink) text-(--on-ink)">
      <div className={cn('mx-auto flex w-full items-center gap-4 px-5 py-4 sm:px-8', largura)}>
        <Link href={home as never} className="shrink-0 rounded-plate">
          <Wordmark size="sm" align="left" />
        </Link>
        {fim ? <div className="ml-auto min-w-0">{fim}</div> : null}
      </div>
      {abaixo}
    </header>
  )
}
