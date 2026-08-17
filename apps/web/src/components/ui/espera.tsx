'use client'

import { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A espera, desenhada com o que a marca já tem.
 *
 * ── O que se sentia ───────────────────────────────────────────────────────
 * A cliente toca no horário das 15:30 e o ecrã fica exatamente igual. Com a
 * rede do telemóvel isso dura meio segundo — tempo que chega para se pensar
 * "não apanhou" e tocar outra vez. Depois o ecrã seguinte aparece de uma vez,
 * inteiro, sem nada que o ligue ao toque que o pediu. É esse corte seco que faz
 * o sistema parecer duro apesar de ser rápido: o problema nunca foi a demora,
 * foi não haver resposta nenhuma durante ela.
 *
 * ── A ideia ───────────────────────────────────────────────────────────────
 * Nada de roda a girar com o logótipo ao centro. Uma marca que se põe a rodar
 * cada vez que se muda de passo deixa de ser assinatura e passa a ser aviso de
 * espera — e o CONTRATO DE DIREÇÃO reserva o gesto autoral a um instante só, o
 * selo da confirmação. O que a marca já tem é a régua de bronze, o fio tirado
 * da coroa da logo que fecha um bloco. É ela que ganha mais um trabalho:
 * enquanto o ecrã seguinte não chega, a régua atravessa o topo. A mesma linha
 * que separa, agora a medir.
 *
 * São três tempos, e nenhum é enfeite:
 *
 *   0 ms     O elemento tocado recolhe. É a única resposta que interessa nesse
 *            instante — o dedo está ali, e é ali que tem de acontecer algo.
 *   150 ms   Só se a espera chegar aqui é que a régua aparece. Abaixo disto a
 *            navegação sente-se instantânea e o fio era um pisca-pisca; e o
 *            Next pré-carrega o destino, portanto na maioria dos toques a
 *            régua nunca chega a existir. Foi por isso que o limiar ficou.
 *   chegou   O conteúdo acende ao entrar (`.entra`, em globals.css). Curto de
 *            propósito: não é uma entrada, é a continuação do toque.
 *
 * A régua sai depressa e trava nos 92% — ela não sabe quanto falta, e uma
 * barra que enche até ao fim e depois espera mente duas vezes. Quem chega ao
 * fim é o ecrã, que a leva consigo.
 *
 * ── Como se usa ───────────────────────────────────────────────────────────
 * Dentro de um `<Link>`, como filho direto:
 *
 *     <Link href={…}>
 *       <EmTransito />
 *       …
 *     </Link>
 *
 * `useLinkStatus` só responde a partir de dentro do link, e o `data-espera`
 * que o `EmTransito` deixa é o que faz o próprio link recolher — o `:has()`
 * está em globals.css, para não haver contrato de posicionamento nenhum no
 * sítio onde se usa.
 *
 * Formulário não precisa disto: os botões de submeter já trocam de texto ("A
 * procurar…", "A confirmar…"), que é resposta mais clara do que qualquer fio.
 * O que lhes falta é só a régua, e para esses há `ReguaDeEspera`.
 */

/** Abaixo disto a espera não se sente, e a régua só piscava. */
const LIMIAR_MS = 150

/** Dentro de um `<Link>`. Reconhece o toque e mede a espera. */
export function EmTransito() {
  const { pending } = useLinkStatus()

  if (!pending) return null
  return (
    <span data-espera className="sr-only">
      <span role="status">A carregar…</span>
      <ReguaDeEspera ativa />
    </span>
  )
}

/**
 * A régua sozinha, para quem já sabe que está à espera por outra via — um
 * `router.push` depois de escolher os serviços, uma ação de servidor a gravar.
 * O limiar dos 150 ms é aplicado aqui dentro, para ser o mesmo em todo o lado.
 */
export function ReguaDeEspera({ ativa }: { ativa: boolean }) {
  const demorou = useDemora(ativa)
  if (!ativa || !demorou || typeof document === 'undefined') return null

  /*
    Portal para o `body`: a régua é fixa ao ecrã e qualquer ascendente com
    `transform` — e há vários, do `active:translate-y-px` para baixo — passaria
    a ser o bloco de contenção dela, atirando-a para o meio da página.
  */
  return createPortal(<span aria-hidden className="regua-de-espera" />, document.body)
}

/**
 * O terceiro tempo: o conteúdo que chegou acende.
 *
 * A chave é o caminho, e é o ponto todo desta camada. Uma animação de CSS só
 * corre quando o elemento nasce, e o router reaproveita a árvore que já está no
 * ecrã sempre que pode — sem a chave, o acender acontecia no primeiro
 * carregamento e nunca mais, que é exatamente o defeito que se quer arranjar.
 *
 * Caminho, não `searchParams`: escolher a profissional na tela de horários
 * troca `?p=`, e nesse caso a lista filtra no sítio. Reanimar a tela inteira
 * por causa de um filtro seria o oposto de continuidade — o que mudou foi uma
 * parte, não o ecrã.
 *
 * Só opacidade, nunca `transform` — a razão inteira está no `.entra` do
 * globals.css, e é uma regra: isto embrulha o corpo de todos os ecrãs, e um
 * embrulho que anima `transform` rouba o `position: fixed` de tudo o que está
 * lá dentro. Quem puser aqui uma subida de seis pixels tira outra vez a barra
 * de ação da vista da cliente.
 */
export function Entrada({ className, children }: { className?: string; children: React.ReactNode }) {
  const caminho = usePathname()
  return (
    <div key={caminho} className={className ? `entra ${className}` : 'entra'}>
      {children}
    </div>
  )
}

/** Verdadeiro só depois de a espera passar de instantânea. */
function useDemora(pendente: boolean): boolean {
  const [demorou, setDemorou] = useState(false)

  useEffect(() => {
    if (!pendente) {
      setDemorou(false)
      return
    }
    const id = setTimeout(() => setDemorou(true), LIMIAR_MS)
    return () => clearTimeout(id)
  }, [pendente])

  return demorou
}
