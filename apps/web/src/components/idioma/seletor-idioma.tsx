'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { COOKIE_IDIOMA, IDIOMAS, MAX_AGE_IDIOMA, NOME_DO_IDIOMA, type Idioma } from '@/i18n/tipos'
import { cn } from '@/lib/utils'

/**
 * PT · EN · ES, em texto, na faixa de tinta do topo.
 *
 * Três diferenças face ao selector de tema, e todas têm a mesma causa: o tema é
 * CSS e a língua é conteúdo.
 *
 * 1. **Chama `router.refresh()`.** O tema pinta-se no cliente mexendo num
 *    atributo do `<html>`; o texto vem do servidor, que tem de o reescrever.
 *    Sem o refresh o cookie ficava gravado e a página continuava em português
 *    até a pessoa navegar — o que se lê como botão avariado.
 * 2. **Recebe a língua por props em vez de a ler no primeiro efeito.** O tema
 *    atravessaria seis layouts para poupar um instante sem botão marcado; aqui
 *    são quatro sítios que já têm o idioma na mão (leram-no para escolher o
 *    dicionário), e o SSR passa a marcar o botão certo à primeira.
 * 3. **Não encolhe para um botão no telemóvel.** Três códigos de duas letras
 *    ocupam menos do que três ícones com moldura, e a razão de ser deste
 *    controlo é dizer que as outras duas línguas existem — um botão que roda
 *    esconde exactamente isso.
 *
 * Sem bandeiras. Bandeira é país, e este é o eixo da língua: a bandeira
 * espanhola diria a uma colombiana que o site não é para ela.
 */
export function SeletorIdioma({ atual, rotulo }: { atual: Idioma; rotulo: string }) {
  const router = useRouter()
  const [aCarregar, transicao] = useTransition()
  const [pedido, setPedido] = useState<Idioma | null>(null)

  /*
    Enquanto o servidor reescreve, mostra a língua pedida; quando assenta,
    volta a mandar o que o servidor diz. Assim o botão acende no clique, e se o
    cookie for recusado (navegador fechado a cookies) a marca salta sozinha
    para a verdade em vez de mentir para sempre.
  */
  const marcado = aCarregar && pedido ? pedido : atual

  function escolher(idioma: Idioma) {
    if (idioma === atual) return
    document.cookie = `${COOKIE_IDIOMA}=${idioma}; path=/; max-age=${MAX_AGE_IDIOMA}; samesite=lax`
    setPedido(idioma)
    transicao(() => router.refresh())
  }

  return (
    <div
      role="radiogroup"
      aria-label={rotulo}
      aria-busy={aCarregar || undefined}
      className={cn(
        'border-(--border-on-ink) flex shrink-0 items-center gap-0.5 rounded-plate border p-0.5 transition-opacity',
        aCarregar && 'opacity-60',
      )}
    >
      {IDIOMAS.map((idioma) => (
        <button
          key={idioma}
          type="button"
          role="radio"
          aria-checked={marcado === idioma}
          aria-label={NOME_DO_IDIOMA[idioma]}
          title={NOME_DO_IDIOMA[idioma]}
          onClick={() => escolher(idioma)}
          className={cn(
            'rounded-plate flex h-8 items-center px-2 text-xs font-medium tracking-wide uppercase transition-colors',
            marcado === idioma
              ? 'bg-(--on-ink) text-(--surface-ink)'
              : 'text-(--on-ink-muted) hover:text-(--on-ink)',
          )}
        >
          {idioma}
        </button>
      ))}
    </div>
  )
}
