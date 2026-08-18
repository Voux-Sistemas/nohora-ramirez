'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { cn, href } from '@/lib/utils'

export interface DestinoOperacao {
  id: string
  path: string
  label: string
  /** Secção que existe por loja: `/agenda/valongo`, `/caixa/valongo`. */
  comLoja?: boolean
}

export interface LojaDaBarra {
  slug: string
  name: string
}

/**
 * A navegação da oficina, e a loja que anda com ela.
 *
 * Havia três telas intermédias iguais — "de que loja quer ver o dia?", "de que
 * loja quer abrir o caixa?", "quem falta avisar, em qual loja" — cada uma um
 * ecrã inteiro para responder a uma pergunta que a pessoa já tinha respondido
 * um minuto antes. A dona a olhar para o Valongo que carregava em Caixa era
 * mandada escolher o Valongo outra vez.
 *
 * Agora a loja é estado da barra: quem está em `/agenda/valongo` e carrega em
 * Caixa vai para `/caixa/valongo`. A loja segue a pessoa entre secções, e
 * trocar de loja é o seletor aqui ao lado — um gesto, no mesmo sítio, sempre.
 * "Todas" segue-a da mesma maneira: quem está a ver as duas agendas e carrega
 * em Caixa vê as duas gavetas.
 *
 * É do lado do cliente por uma razão só: quem sabe em que loja a pessoa está é
 * o endereço, e a casca que desenha a barra vive um nível acima do `[unidade]`,
 * portanto não o recebe. Ler o caminho aqui evita empurrar o slug por seis
 * cascas — e o resto da barra (o nome, o sair, o tema) continua no servidor.
 *
 * O segundo trecho do caminho só conta como loja se **corresponder a uma loja
 * que esta pessoa vê**. Sem essa conferência, `/clientes/<id>` daria uma loja
 * chamada com o id de uma cliente, e a barra passaria a oferecer endereços que
 * não existem.
 */
export function NavOperacao({
  destinos,
  lojas,
  active,
}: {
  destinos: readonly DestinoOperacao[]
  lojas: readonly LojaDaBarra[]
  active?: string
}) {
  const pathname = usePathname()

  const segmentos = pathname.split('/').filter(Boolean)
  const secao = segmentos[0]
  const lojaAtual = lojas.find((loja) => loja.slug === segmentos[1])?.slug
  const secaoTemLoja = destinos.some((destino) => destino.id === active && destino.comLoja)

  return (
    /*
      Os destinos e a loja são um bloco só — no telemóvel descem juntos para a
      segunda fila da barra, e "em que secção estou" e "em que loja estou" são
      metades da mesma resposta. Enquanto eram dois irmãos soltos, a barra tinha
      de os arrumar um a um e o seletor de loja ia parar ao meio do logótipo.

      Aí embrulham: no telemóvel as lojas ficam com uma fila inteira para si, em
      vez de disputarem trezentos e cinquenta pixels com cinco secções — nessa
      disputa a tira das secções sobrava com espaço para duas, e trocar de loja
      passava por rolar a barra de lado para ir buscar um controlo escondido.
    */
    <div className="order-3 flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 sm:order-2 sm:w-auto sm:flex-1 sm:flex-nowrap">
      {/*
        Rolagem horizontal em vez de menu escondido: são cinco destinos fixos e
        curtos. Esconder atrás de um botão custaria um toque a cada troca, que é
        a ação mais repetida do turno.
      */}
      <nav
        aria-label="Secções"
        className="-mb-px flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto"
      >
        {destinos.map((destino) => {
          const atual = active === destino.id
          const alvo = destino.comLoja && lojaAtual ? `${destino.path}/${lojaAtual}` : destino.path
          return (
            <Link
              key={destino.id}
              href={href(alvo)}
              aria-current={atual ? 'page' : undefined}
              className={cn(
                'rounded-plate relative flex shrink-0 items-center px-3 text-sm whitespace-nowrap transition-colors',
                // alvo de 44px de pé, com luz de salão e a mão ocupada
                'min-h-11',
                atual ? 'font-medium text-(--on-ink)' : 'text-(--on-ink-muted) hover:text-(--on-ink)',
              )}
            >
              {destino.label}
              {atual ? (
                <span aria-hidden className="absolute inset-x-2 bottom-0 h-px bg-(--on-ink-accent)" />
              ) : null}
            </Link>
          )
        })}
      </nav>

      {/* Com uma loja só não há nada a escolher, e o seletor seria um controlo
          que nunca muda nada — a mesma tela intermédia de antes, encolhida. */}
      {secao && secaoTemLoja && lojas.length > 1 ? (
        /* `useSearchParams` obriga a uma fronteira de suspensão, e ela é aqui e
           não à volta da barra inteira: o que fica em branco por um instante é
           o seletor, e não a navegação toda. */
        <Suspense fallback={null}>
          <SeletorDeLoja secao={secao} lojas={lojas} lojaAtual={lojaAtual} />
        </Suspense>
      ) : null}
    </div>
  )
}

/**
 * A loja como um comutador de duas posições e mais uma — não como uma lista.
 *
 * Era um `<select>` escuro sobre a faixa escura, com uma seta de catorze pixels
 * por única marca de que era clicável. Na reunião apareceu escrito assim:
 * "melhorar visibilidade de switch". Um menu suspenso é o desenho certo quando
 * as opções não cabem à vista e a escolha é rara — aqui são duas lojas e é a
 * escolha mais repetida do turno, e nesse caso o desenho certo é mostrá-las
 * todas e acender a que está.
 *
 * "Todas" vem primeiro e é uma opção como as outras porque é um sítio como os
 * outros: a agenda das duas lojas, o caixa das duas, a fila das duas. Antes não
 * existia — `/agenda` sem loja atirava para a primeira da lista — e era por isso
 * que voltar atrás mudava de loja sem ninguém ter pedido.
 *
 * A consulta viaja com a troca, tirando `sel`: quem está no dia 27 da Maia
 * continua no dia 27 ao passar para Valongo, mas o atendimento aberto na ficha
 * lateral é de lá e não existe cá.
 */
function SeletorDeLoja({
  secao,
  lojas,
  lojaAtual,
}: {
  secao: string
  lojas: readonly LojaDaBarra[]
  lojaAtual: string | undefined
}) {
  const consulta = useSearchParams()
  const restante = new URLSearchParams(consulta)
  restante.delete('sel')
  const cauda = restante.toString()
  const sufixo = cauda ? `?${cauda}` : ''

  const opcoes = [
    { chave: 'todas', label: 'Todas', alvo: `/${secao}${sufixo}`, ativa: lojaAtual === undefined },
    ...lojas.map((loja) => ({
      chave: loja.slug,
      label: loja.name,
      alvo: `/${secao}/${loja.slug}${sufixo}`,
      ativa: loja.slug === lojaAtual,
    })),
  ]

  return (
    <div
      /* Um grupo de links, não um `radiogroup`: cada opção é um endereço, e o
         leitor de ecrã deve anunciá-la como o que ela é — um sítio para onde ir.
         O rótulo do grupo é que diz de que escolha se trata. */
      role="group"
      aria-label="Loja"
      className="rounded-plate flex w-full shrink-0 items-center gap-0.5 border border-(--border-on-ink) p-0.5 sm:w-auto"
    >
      {opcoes.map((opcao) => (
        <Link
          key={opcao.chave}
          href={href(opcao.alvo)}
          aria-current={opcao.ativa ? 'true' : undefined}
          className={cn(
            'rounded-plate flex flex-1 items-center justify-center px-3 text-sm whitespace-nowrap transition-colors sm:flex-none',
            /* 44px no telemóvel, onde a fila é dele e o dedo é grosso; os 36px
               de antes no rato, onde ela divide a fila com as secções. */
            'min-h-11 sm:min-h-9',
            opcao.ativa
              ? 'bg-(--on-ink) font-medium text-(--surface-ink)'
              : 'text-(--on-ink-muted) hover:text-(--on-ink)',
          )}
        >
          {opcao.label}
        </Link>
      ))}
    </div>
  )
}
