import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ImportForm } from '@/components/clients/import-form'
import { PainelShell } from '@/components/shell/painel-shell'
import { href } from '@/lib/utils'
import { podeGerir } from '@/server/auth/permissoes'
import { contextoDoPainel } from '@/server/painel/contexto'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Importar clientes' }

export default async function ImportarClientesPage() {
  const { acesso, unidades, unidade } = await contextoDoPainel()
  if (!podeGerir(acesso)) redirect('/painel/agenda')

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="clientes"
      titulo="Importar clientes"
      semCasa
    >
      <div className="max-w-2xl">
        <Link href={href('/painel/clientes')} className="text-muted text-sm hover:underline">
          ← clientes
        </Link>

        <p className="text-body mt-4 mb-6 text-sm leading-relaxed">
          Envie um CSV com as colunas <strong>nome</strong> e <strong>telefone</strong> (e,
          opcionalmente, <strong>email</strong>). Quem já tem cadastro pelo telemóvel só recebe o
          e-mail, se estiver a faltar.
        </p>

        <div className="rounded-plate border border-(--border-subtle) bg-(--surface-raised) p-5">
          <ImportForm />
        </div>
      </div>
    </PainelShell>
  )
}
