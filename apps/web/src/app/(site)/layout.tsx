import { SiteFooter } from '@/components/shell/site-footer'
import { SiteHeader } from '@/components/shell/site-header'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * A casca da cliente.
 *
 * Cobre as três telas que ela usa fora da marcação — a página (`/`), a casa
 * (`/casa/…`) e a conta (`/minha-conta`). A marcação fica de fora de
 * propósito: é um fluxo com princípio e fim, e o cabeçalho de navegação ali
 * seria um convite a sair no meio.
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const unidades = await listUnits()

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter unidades={unidades} />
    </div>
  )
}
