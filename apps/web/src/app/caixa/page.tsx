import { UnitPicker } from '@/components/operate/unit-picker'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export default async function CaixaIndexPage() {
  const units = await listUnits()

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">Caixa</h1>
      <p className="text-muted mt-1 text-sm">Abrir o caixa de qual loja.</p>

      <UnitPicker units={units} base="/caixa" />
    </main>
  )
}
