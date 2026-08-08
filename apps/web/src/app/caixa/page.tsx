import { redirect } from 'next/navigation'
import { UnitPicker } from '@/components/operate/unit-picker'
import { requireGestao, unidadesVisiveis } from '@/server/auth/permissoes'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export default async function CaixaIndexPage() {
  const acesso = await requireGestao()
  const units = unidadesVisiveis(acesso, await listUnits())

  /* Quem cuida de uma loja só não escolhe loja: cai direto na gaveta dela. */
  if (units.length === 1) redirect(`/caixa/${units[0]!.slug}`)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">Caixa</h1>
      <p className="text-muted mt-1 text-sm">Abrir o caixa de qual loja.</p>

      {units.length === 0 ? (
        <p className="text-muted mt-8 border-t border-(--border-strong) pt-8 text-sm">
          Nenhuma loja atribuída a você ainda. Fale com a administração.
        </p>
      ) : (
        <UnitPicker units={units} base="/caixa" />
      )}
    </main>
  )
}
