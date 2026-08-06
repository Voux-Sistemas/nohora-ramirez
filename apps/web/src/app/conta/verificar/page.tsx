import { redirect } from 'next/navigation'
import { CodeForm } from '@/components/auth/code-form'
import { formatPhone } from '@/lib/format'

export const metadata = { title: 'Verificar código' }

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string; dev?: string }>
}) {
  const { telefone, dev } = await searchParams
  if (!telefone) redirect('/conta/entrar')

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Digite o código</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        Enviamos um código para {formatPhone(telefone)}.
      </p>
      {dev ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Modo desenvolvimento — código: <span className="font-mono font-semibold">{dev}</span>
        </p>
      ) : null}
      <div className="surface rounded-card p-5">
        <CodeForm telefone={telefone} />
      </div>
    </div>
  )
}
