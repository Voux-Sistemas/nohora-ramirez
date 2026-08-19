import 'server-only'
import { cookies } from 'next/headers'

import { COOKIE_IDIOMA, ehIdioma, type Idioma } from '@/i18n/tipos'

/**
 * A língua da leitora, lida do cookie — o mesmo mecanismo do tema.
 *
 * Sem middleware e sem prefixo de URL, por três razões que se somam: o funil de
 * marcação carrega o estado em searchParams (`s`, `d`, `p`, `t`) e duplicar
 * isso num segmento de caminho multiplicaria as rotas por três; `typedRoutes`
 * obrigaria a declarar cada uma delas à mão; e todas as páginas da superfície
 * da cliente já são `force-dynamic`, portanto ler um cookie não estraga cache
 * nenhum — não há cache a estragar.
 *
 * O preço é uma URL só por página: quem partilha um link partilha-o em
 * português, e o Google indexa português. É uma limitação declarada, não um
 * esquecimento — está no PRODUCT.md.
 */
export async function lerIdioma(): Promise<Idioma> {
  const store = await cookies()
  // Nunca lança: cookie é texto que qualquer pessoa pode escrever, e uma língua
  // inválida não é motivo para deitar a montra abaixo. Cai em português.
  const valor = store.get(COOKIE_IDIOMA)?.value
  return ehIdioma(valor) ? valor : 'pt'
}

/**
 * A língua gravada na ficha da cliente — a outra fonte da mesma pergunta.
 *
 * O cookie diz em que língua alguém está a ler AGORA, neste browser. Isto diz
 * em que língua ela marcou, e é o que decide a mensagem de WhatsApp que parte
 * dias depois, do telemóvel de outra pessoa.
 *
 * `preferences` é jsonb — o guarda existe porque é texto vindo da base de
 * dados, e uma preferência estragada não pode deixar a fila de avisos sem
 * mensagem. Português por omissão é o caso comum e não a excepção: só quem
 * marcou pelo site passou por um selector de idioma.
 */
export function idiomaDaFicha(preferences: Record<string, unknown>): Idioma {
  const guardado = preferences['idioma']
  return ehIdioma(guardado) ? guardado : 'pt'
}
