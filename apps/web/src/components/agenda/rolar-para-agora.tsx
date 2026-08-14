'use client'

import { useEffect } from 'react'

/**
 * Abrir a agenda às três da tarde e ver as oito da manhã é o oposto do que a
 * recepção quer: assim que a grade termina de desenhar, a página rola sozinha
 * até a hora atual. Sem "agora" no dia — outra data, ou fora do expediente —
 * mira na primeira marcação; ainda é melhor do que começar sempre no topo
 * vazio. Sem marcação nenhuma, `alvo` chega nulo e não faz nada.
 *
 * Precisa de `key={data}` em quem usa isto: só assim o React remonta o
 * componente (e o efeito dispara de novo) ao trocar de dia pelas setas. Sem a
 * chave, a instância seria reaproveitada e a rolagem nunca voltaria a rodar —
 * inclusive nas atualizações automáticas da própria tela, que não devem
 * arrastar quem já rolou para outro lugar de volta para o "agora".
 */
export function RolarParaAgora({ alvo }: { alvo: string | null }) {
  useEffect(() => {
    if (!alvo) return
    const elemento = document.getElementById(alvo)
    if (!elemento) return

    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    elemento.scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth', block: 'center' })
  }, [alvo])

  return null
}
