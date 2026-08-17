'use client'

import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  const router = useRouter()
  const pathname = usePathname()

  const segmentos = pathname.split('/').filter(Boolean)
  const secao = segmentos[0]
  const lojaAtual = lojas.find((loja) => loja.slug === segmentos[1])?.slug
  const secaoTemLoja = destinos.some((destino) => destino.id === active && destino.comLoja)

  return (
    <>
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
      {secao && lojaAtual && secaoTemLoja && lojas.length > 1 ? (
        <div className="relative shrink-0">
          <select
            aria-label="Loja"
            value={lojaAtual}
            onChange={(evento) => router.push(href(`/${secao}/${evento.target.value}`))}
            className="rounded-plate min-h-9 cursor-pointer appearance-none border border-(--border-on-ink) bg-(--surface-ink) py-1.5 pr-8 pl-3 text-sm text-(--on-ink) transition-colors hover:border-(--on-ink-muted)"
          >
            {lojas.map((loja) => (
              <option key={loja.slug} value={loja.slug}>
                {loja.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-(--on-ink-muted)"
          />
        </div>
      ) : null}
    </>
  )
}
