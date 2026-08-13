'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { listUnits } from '@/server/scheduling/context'
import { requireAcesso, veUnidade } from '@/server/auth/permissoes'
import { NOME_COOKIE_UNIDADE } from './contexto'

/**
 * Troca a casa activa do painel.
 *
 * Grava o cookie só depois de confirmar que a pessoa vê aquela loja. O cookie
 * é preferência de navegação, e cada tela revalida o alcance na leitura — mas
 * gravar um valor não autorizado deixaria o painel a pedir uma casa que ele
 * depois recusa, e o utilizador leria isso como avaria.
 */
export async function trocarUnidade(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return

  const acesso = await requireAcesso()
  const unidade = (await listUnits()).find((item) => item.slug === slug)
  if (!unidade || !veUnidade(acesso, unidade.id)) return

  const store = await cookies()
  store.set(NOME_COOKIE_UNIDADE, slug, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })

  /* O painel inteiro depende da casa activa — revalidar só a rota actual
     deixaria as outras secções com a loja antiga no cache. */
  revalidatePath('/painel', 'layout')
}
