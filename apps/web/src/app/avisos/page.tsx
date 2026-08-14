import { redirect } from 'next/navigation'
import { UnitPicker } from '@/components/operate/unit-picker'
import { requireGestao, unidadesVisiveis } from '@/server/auth/permissoes'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export default async function AvisosIndexPage() {
  const acesso = await requireGestao()
  const units = unidadesVisiveis(acesso, await listUnits())

  /* Uma loja só: a fila já é a tela: escolher entre uma opção não é escolha. */
  if (units.length === 1) redirect(`/avisos/${units[0]!.slug}`)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">Avisos</h1>
      <p className="text-muted mt-1 text-sm">Quem falta avisar hoje, em qual loja.</p>

      {units.length === 0 ? (
        <p className="text-muted mt-8 border-t border-(--border-strong) pt-8 text-sm">
          Nenhuma loja atribuída a si ainda. Fale com a administração.
        </p>
      ) : (
        <UnitPicker units={units} base="/avisos" />
      )}
    </main>
  )
}
