import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { href } from '@/lib/utils'
import { listUnitsAdmin } from '@/server/admin/units'
import { podeSuporte, requireRede } from '@/server/auth/permissoes'

export default async function UnidadesPage() {
  const acesso = await requireRede()
  const units = await listUnitsAdmin()

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/unidades"
      title="Unidades"
      subtitle="Endereço, horário de funcionamento e regras de agendamento de cada loja."
      /* Abrir loja mexe em cobrança e em tudo que pendura em unidade — é pedido
         que passa pelo suporte, então para a dona o botão nem existe. */
      actions={
        podeSuporte(acesso) ? (
          <Link href="/admin/unidades/nova">
            <Button size="sm">+ nova unidade</Button>
          </Link>
        ) : null
      }
    >
      <div className="surface rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted border-b border-(--border-subtle) text-left">
            <tr>
              <th className="p-3 font-medium">Nome</th>
              <th className="p-3 font-medium">Cidade</th>
              <th className="p-3 font-medium">Telefone</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr
                key={u.id}
                className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
              >
                <td className="p-3">
                  <Link href={href(`/admin/unidades/${u.id}`)} className="font-medium hover:underline">
                    {u.name}
                  </Link>
                  <div className="text-muted text-xs">/{u.slug}</div>
                </td>
                <td className="p-3">{u.city ?? '—'}</td>
                <td className="p-3">{u.phone ?? '—'}</td>
                <td className="p-3">
                  <span className={u.active ? 'text-(--color-signal-good)' : 'text-muted'}>
                    {u.active ? 'ativa' : 'inativa'}
                  </span>
                </td>
              </tr>
            ))}
            {units.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted p-6 text-center">
                  Nenhuma unidade cadastrada ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
