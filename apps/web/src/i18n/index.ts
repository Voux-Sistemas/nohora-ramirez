import { en } from './en'
import { es } from './es'
import { pt, type Dicionario } from './pt'
import type { Idioma } from './tipos'

export type { Dicionario } from './pt'
export { interpola, pedacos, type Pedaco, type Variaveis } from './interpola'
export { IDIOMAS, NOME_DO_IDIOMA, ehIdioma, localeDe, ogLocaleDe, type Idioma } from './tipos'

const DICIONARIOS: Record<Idioma, Dicionario> = { pt, en, es }

/**
 * As frases da língua pedida.
 *
 * Síncrona e sem promessa nenhuma: os três dicionários são objectos literais
 * que entram no mesmo pacote. Carregá-los à parte pouparia uns quilobytes e
 * pagaria com um `await` em cada página da montra — nesta escala, não vale.
 *
 * O padrão nas páginas é uma linha:
 *
 * ```ts
 * const dic = dicionario(await lerIdioma())
 * ```
 *
 * e daí para baixo o JSX só lê `dic.*`. Os componentes de cliente recebem a
 * secção que lhes toca por props — são dados planos, atravessam a fronteira
 * do servidor sem cerimónia.
 */
export function dicionario(idioma: Idioma): Dicionario {
  return DICIONARIOS[idioma]
}
