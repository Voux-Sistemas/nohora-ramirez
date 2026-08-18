import 'server-only'

/**
 * Tema claro/escuro do produto.
 *
 * Vive sempre em `<html data-theme="light|dark">`, nunca em
 * `prefers-color-scheme` — decidido no servidor a partir de um cookie, para o
 * primeiro pintar já acertar, sem flash e sem script inline. O padrão, sem
 * cookie, é **claro em todo o produto**, inclusive na área da cliente
 * (DESIGN.md secção 7).
 *
 * "Sistema" é um caso especial: o servidor não sabe a preferência do sistema
 * operativo de quem pediu a página. Por isso o cookie não guarda só a escolha
 * — guarda a escolha já resolvida (`sistema-claro` / `sistema-escuro`). O
 * controlo do lado do cliente (`components/tema/seletor-tema.tsx`) é quem
 * resolve por `matchMedia` e regrava o cookie sempre que o sistema muda,
 * então o servidor está sempre a um passo atrás, nunca errado por muito
 * tempo, e nunca errado na visita seguinte.
 */

import { cookies } from 'next/headers'

export type Modo = 'claro' | 'escuro' | 'sistema'
export type Resolvido = 'light' | 'dark'
type Valor = 'claro' | 'escuro' | 'sistema-claro' | 'sistema-escuro'

const COOKIE_TEMA = 'tema'

export interface Tema {
  /** O que aparece marcado no seletor. */
  modo: Modo
  /** O que o CSS entende — o que vai para `data-theme`. */
  resolvido: Resolvido
}

function normaliza(valor: string | undefined): Valor {
  if (valor === 'claro' || valor === 'escuro' || valor === 'sistema-claro' || valor === 'sistema-escuro') {
    return valor
  }
  return 'claro'
}

/** Lê a preferência salva da pessoa. Sem cookie, ou cookie inválido, é claro. */
export async function lerTema(): Promise<Tema> {
  const store = await cookies()
  const valor = normaliza(store.get(COOKIE_TEMA)?.value)
  const modo: Modo = valor.startsWith('sistema') ? 'sistema' : (valor as Modo)
  const resolvido: Resolvido = valor === 'escuro' || valor === 'sistema-escuro' ? 'dark' : 'light'
  return { modo, resolvido }
}
