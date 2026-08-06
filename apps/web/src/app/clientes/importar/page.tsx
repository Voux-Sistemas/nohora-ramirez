import Link from 'next/link'
import { ImportForm } from '@/components/clients/import-form'
import { href } from '@/lib/utils'

export const metadata = { title: 'Importar clientes' }

export default function ImportarClientesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href={href('/clientes')} className="text-muted text-sm hover:underline">
        ← clientes
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">Importar clientes</h1>
        <p className="text-muted mt-1 text-sm">
          Envie um CSV com as colunas <strong>nome</strong> e <strong>telefone</strong> (e opcionalmente{' '}
          <strong>email</strong>). Quem já tem cadastro pelo telefone só recebe o e-mail, se estiver
          faltando.
        </p>
      </header>

      <div className="surface rounded-card p-5">
        <ImportForm />
      </div>
    </div>
  )
}
