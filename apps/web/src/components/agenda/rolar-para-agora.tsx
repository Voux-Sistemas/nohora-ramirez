'use client'

import { useEffect } from 'react'

/**
 * Abrir a agenda às três da tarde e ver as oito da manhã é o oposto do que a
 * recepção quer: assim que a grade termina de desenhar, a página rola sozinha
 * até a hora atual. Sem "agora" no dia — outra data, ou fora do expediente —
 * mira na primeira marcação; ainda é melhor do que começar sempre no topo
 * vazio. Sem marcação nenhuma, não chega alvo e não faz nada.
 *
 * São vários alvos porque são dois quadros: a lista do telemóvel e a grade do
 * balcão vivem as duas no HTML, e é o CSS que decide qual aparece — o servidor
 * não sabe a largura do ecrã. Rolar até um elemento escondido não faz nada e
 * não avisa; por isso aqui o primeiro alvo que estiver mesmo pintado é o que
 * vale. `getClientRects` responde exatamente essa pergunta: um elemento com
 * `display:none` (ele ou qualquer ascendente) não tem retângulo nenhum.
 *
 * Precisa de `key={data}` em quem usa isto: só assim o React remonta o
 * componente (e o efeito dispara de novo) ao trocar de dia pelas setas. Sem a
 * chave, a instância seria reaproveitada e a rolagem nunca voltaria a rodar —
 * inclusive nas atualizações automáticas da própria tela, que não devem
 * arrastar quem já rolou para outro lugar de volta para o "agora".
 */
export function RolarParaAgora({ alvos }: { alvos: readonly string[] }) {
  /* Lista nova a cada render seria efeito a cada render; a chave é o conteúdo. */
  const chave = alvos.join('|')

  useEffect(() => {
    const elemento = chave
      .split('|')
      .filter(Boolean)
      .map((id) => document.getElementById(id))
      .find((candidato) => candidato !== null && candidato.getClientRects().length > 0)
    if (!elemento) return

    const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    elemento.scrollIntoView({ behavior: semMovimento ? 'auto' : 'smooth', block: 'center' })
  }, [chave])

  return null
}
