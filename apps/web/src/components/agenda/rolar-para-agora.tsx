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
 *
 * **Menos o botão de trás.** Voltar é pedir a tela como ela estava, e o
 * navegador devolve a posição de rolagem junto — para logo a seguir esta
 * rolagem a arrastar para outro sítio, à frente de quem está a olhar. Quem
 * carrega em voltar não pediu o "agora": pediu o que já tinha visto.
 */

/*
 * Módulo, não estado do componente: a instância morre e nasce a cada dia
 * (`key={data}`), e a pergunta "como é que se chegou a este dia" é anterior a
 * ela. `popstate` marca; qualquer gesto na página desmarca, porque um gesto é
 * sempre um destino escolhido — é o que faz as setas de dia voltarem a rolar
 * logo a seguir a um passo atrás.
 *
 * São precisas as duas perguntas porque há dois voltares. `popstate` responde
 * pelo voltar dentro do mesmo documento, que é o comum; mas o campo "Ir para
 * uma data" é um `<form>` de HTML e faz navegação de página inteira, e a
 * agenda é `force-dynamic` — servida com `no-store`, fica fora do bfcache.
 * Voltar dali carrega um documento novo, onde este módulo re-avalia a zero e
 * `popstate` nunca chega a disparar. `getEntriesByType('navigation')` é a
 * mesma pergunta feita ao carregamento em vez de ao histórico, e é a única que
 * responde nesse caminho.
 *
 * O teclado desmarca ao lado do ponteiro: quem carrega em Enter no "hoje" ou
 * submete o campo de data escolheu o destino tanto como quem clicou. Sem isso a
 * marca ficava pendurada depois de um voltar que não remonta o componente —
 * fechar a ficha lateral, que muda `sel` e não `d` — e comia a rolagem da
 * mudança de dia seguinte.
 */
let veioDoBotaoDeTras = chegouPorTravessia()

function chegouPorTravessia(): boolean {
  if (typeof performance === 'undefined') return false
  const [entrada] = performance.getEntriesByType('navigation')
  return (entrada as PerformanceNavigationTiming | undefined)?.type === 'back_forward'
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    veioDoBotaoDeTras = true
  })
  const escolheu = () => {
    veioDoBotaoDeTras = false
  }
  window.addEventListener('pointerdown', escolheu, true)
  window.addEventListener('keydown', escolheu, true)
}
export function RolarParaAgora({ alvos }: { alvos: readonly string[] }) {
  /* Lista nova a cada render seria efeito a cada render; a chave é o conteúdo. */
  const chave = alvos.join('|')

  useEffect(() => {
    if (veioDoBotaoDeTras) {
      veioDoBotaoDeTras = false
      return
    }

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
