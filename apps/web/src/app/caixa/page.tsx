import { redirect } from 'next/navigation'
import { SemLoja } from '@/components/operate/sem-loja'
import { requireGestao, unidadesVisiveis } from '@/server/auth/permissoes'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/** A gaveta abre na loja em que se está — ver `/agenda/page.tsx`. */
export default async function CaixaIndexPage() {
  const acesso = await requireGestao()
  const unidades = unidadesVisiveis(acesso, await listUnits())
  if (unidades.length > 0) redirect(`/caixa/${unidades[0]!.slug}`)

  return <SemLoja titulo="Caixa" />
}
