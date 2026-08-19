/**
 * O eixo da língua — e por que ele não é o eixo do país.
 *
 * `lib/pais.ts` já decide moeda, formato de telefone e vocabulário de praça: o
 * salão é português, cobra em euro e chama telemóvel ao telemóvel. Isso não
 * muda com quem está a ler. O que muda é a LÍNGUA em que se lê, e as duas
 * coisas são ortogonais: uma inglesa marca em inglês e continua a pagar em
 * euros, num número português, numa casa no Porto.
 *
 * Juntar os dois eixos num só transformaria "quero ler em inglês" em "sou de
 * outro país", e o preço passaria a libras numa casa que não as aceita. Por
 * isso `pais()` não é tocado por nada neste directório.
 *
 * Só a superfície da cliente é traduzida — montra, marcação e conta. A gestão
 * da equipa fica em português, que é a língua de quem trabalha na casa:
 * traduzir a agenda seria manutenção paga em três línguas por um ecrã que
 * quatro pessoas vêem.
 *
 * NÃO leva `server-only`. As secções do dicionário viajam por props para
 * componentes de cliente, e os testes de paridade importam-nas directamente —
 * tudo aqui é dado plano e serializável, de propósito.
 */

export type Idioma = 'pt' | 'en' | 'es'

/**
 * O nome do cookie vive aqui, e não em `lib/idioma.ts`, porque tem dois donos:
 * o servidor lê-o e o selector escreve-o. `lib/idioma.ts` leva `server-only` e
 * o selector é um componente de cliente — se a constante morasse lá, o nome
 * teria de ser copiado à mão dos dois lados, que é como se troca um por engano.
 */
export const COOKIE_IDIOMA = 'idioma'

/** Um ano. A escolha da língua não é coisa para se repetir a cada visita. */
export const MAX_AGE_IDIOMA = 31_536_000

export const IDIOMAS = ['pt', 'en', 'es'] as const satisfies readonly Idioma[]

/** O que aparece no selector — cada língua escrita na própria língua. */
export const NOME_DO_IDIOMA: Record<Idioma, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
}

/**
 * Guarda de tipo. Serve o cookie (texto de quem quiser escrevê-lo) e o
 * `preferences.idioma` da ficha, que é jsonb e por isso `unknown` até prova em
 * contrário.
 */
export function ehIdioma(valor: unknown): valor is Idioma {
  return valor === 'pt' || valor === 'en' || valor === 'es'
}

/**
 * A etiqueta BCP-47 que o `Intl` entende, para datas e nomes de mês.
 *
 * Português é pt-PT e não pt-BR — a casa é portuguesa; inglês é en-GB pela
 * mesma razão de vizinhança (e porque "8 August" antes de "August 8" é o que
 * uma cliente em Portugal espera ler). Isto é a língua do TEXTO, não a praça:
 * dinheiro e telefone continuam a sair de `pais()`.
 */
export function localeDe(idioma: Idioma): string {
  switch (idioma) {
    case 'en':
      return 'en-GB'
    case 'es':
      return 'es-ES'
    case 'pt':
      return 'pt-PT'
  }
}

/** A etiqueta que vai para `openGraph.locale`, que usa `_` em vez de `-`. */
export function ogLocaleDe(idioma: Idioma): string {
  return localeDe(idioma).replace('-', '_')
}
