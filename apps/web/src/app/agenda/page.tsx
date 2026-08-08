import { redirect } from 'next/navigation'
import { UnitPicker } from '@/components/operate/unit-picker'
import { requireAcesso, unidadesVisiveis } from '@/server/auth/permissoes'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export default async function AgendaIndexPage() {
  const acesso = await requireAcesso()
  const units = unidadesVisiveis(acesso, await listUnits())

  /*
    Uma loja só não é escolha, é um passo a mais. A profissional que atende num
    lugar só cairia todo dia numa tela com um botão — e o botão é o começo do
    trabalho dela, não uma decisão. Vale para o gerente de uma unidade também.
  */
  if (units.length === 1) redirect(`/agenda/${units[0]!.slug}`)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">Agenda do dia</h1>
      <p className="text-muted mt-1 text-sm">Ver o dia de qual loja.</p>

      {units.length === 0 ? (
        <p className="text-muted mt-8 border-t border-(--border-strong) pt-8 text-sm">
          Nenhuma loja atribuída a você ainda. Fale com a administração.
        </p>
      ) : (
        <UnitPicker units={units} base="/agenda" />
      )}
    </main>
  )
}
