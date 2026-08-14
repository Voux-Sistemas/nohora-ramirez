import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Estado } from '@/components/admin/estado'
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
      {units.length === 0 ? (
        <p className="text-muted p-6 text-center text-sm">Nenhuma unidade cadastrada ainda.</p>
      ) : (
        <div className="surface rounded-card overflow-hidden">
          <table className="hidden w-full text-[0.9375rem] sm:table">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="p-3.5 font-medium">Nome</th>
                <th className="p-3.5 font-medium">Cidade</th>
                <th className="p-3.5 font-medium">Telefone</th>
                <th className="p-3.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
                >
                  <td className="p-3.5">
                    <Link href={href(`/admin/unidades/${u.id}`)} className="font-medium hover:underline">
                      {u.name}
                    </Link>
                    <div className="text-muted text-xs">/{u.slug}</div>
                  </td>
                  <td className="text-muted p-3.5">{u.city ?? '—'}</td>
                  <td className="text-muted p-3.5">{u.phone ?? '—'}</td>
                  <td className="p-3.5">
                    <Estado ativo={u.active} ligado="ativa" desligado="inativa" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="sm:hidden">
            {units.map((u) => (
              <li key={u.id} className="border-b border-(--border-subtle) p-3.5 last:border-0">
                <Link href={href(`/admin/unidades/${u.id}`)} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{u.name}</span>
                  <Estado ativo={u.active} ligado="ativa" desligado="inativa" />
                </Link>
                <div className="text-muted mt-1 text-sm">
                  {u.city ?? '—'} · {u.phone ?? '—'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminShell>
  )
}
