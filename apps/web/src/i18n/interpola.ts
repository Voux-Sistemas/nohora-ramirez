/**
 * Preencher os buracos `{assim}` das frases do dicionário.
 *
 * Mesma mecânica do `renderMessage` das notificações — de propósito: quem já
 * escreveu um corpo de WhatsApp reconhece a sintaxe ao escrever uma frase da
 * montra, e o teste de paridade dos dicionários usa a mesma expressão regular
 * para conferir que as três línguas pedem exactamente as mesmas variáveis.
 *
 * Chave em falta sai como texto vazio, nunca como `undefined` — uma frase a que
 * falta uma palavra ainda se lê; uma frase com "undefined" no meio é um bug
 * visível à cliente.
 */

/** Um `{nome}` no meio de uma frase. Partilhada com o teste de paridade. */
export const BURACO = /\{(\w+)\}/g

export type Variaveis = Record<string, string | number>

/** `interpola('Abre às {hora}', { hora: '09:00' })` → `'Abre às 09:00'`. */
export function interpola(modelo: string, vars: Variaveis = {}): string {
  return modelo.replace(BURACO, (_todo, nome: string) => {
    const valor = vars[nome]
    return valor === undefined ? '' : String(valor)
  })
}

/**
 * Um pedaço de uma frase já partida: ou texto literal, ou o nome de um buraco.
 *
 * Existe porque três frases da superfície precisam de marcação HTML no meio
 * (o sinal em `font-medium`, o telemóvel destacado, o e-mail mascarado), e
 * `dangerouslySetInnerHTML` numa string traduzida é a porta aberta que não se
 * abre. Partir a frase e deixar o JSX preencher os buracos dá o mesmo destaque
 * sem confiar em nada.
 */
export type Pedaco = { texto: string } | { buraco: string }

export function pedacos(modelo: string): Pedaco[] {
  const saida: Pedaco[] = []
  let fim = 0
  for (const encontro of modelo.matchAll(BURACO)) {
    const inicio = encontro.index
    if (inicio > fim) saida.push({ texto: modelo.slice(fim, inicio) })
    saida.push({ buraco: encontro[1]! })
    fim = inicio + encontro[0].length
  }
  if (fim < modelo.length) saida.push({ texto: modelo.slice(fim) })
  return saida
}
