import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import { listStaffAdmin } from '@/server/admin/staff'
import { requireGestao } from '@/server/auth/permissoes'

/* A lista já vem recortada: o gerente do Centro não abre a ficha nem o telefone
   de quem só atende no Jardins. */
export default async function EquipePage() {
  const acesso = await requireGestao()
  const staff = await listStaffAdmin(acesso.unidadeIds)

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/equipe"
      title="Equipe"
      subtitle="Profissionais, unidades onde atendem e escala semanal."
      actions={
        <Link href="/admin/equipe/novo">
          <Button size="sm">+ novo profissional</Button>
        </Link>
      }
    >
      <div className="surface rounded-card overflow-hidden overflow-x-auto">
        <table className="w-full text-[0.9375rem]">
          <thead className="text-muted border-b border-(--border-subtle) text-left">
            <tr>
              <th className="p-3.5 font-medium">Nome</th>
              <th className="p-3.5 font-medium">Telefone</th>
              <th className="p-3.5 font-medium">Unidades</th>
              <th className="p-3.5 font-medium">Acesso</th>
              <th className="p-3.5 font-medium">Online</th>
              <th className="p-3.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr
                key={s.id}
                className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
              >
                <td className="p-3.5">
                  <Link href={href(`/admin/equipe/${s.id}`)} className="flex items-center gap-2 font-medium hover:underline">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </Link>
                </td>
                <td className="p-3.5">{formatPhone(s.phone)}</td>
                <td className="text-muted p-3.5">{s.unitNames.join(', ') || '—'}</td>
                <td className="text-muted p-3.5">{s.papel}</td>
                <td className="p-3.5">{s.acceptsOnlineBooking ? 'sim' : 'não'}</td>
                <td className="p-3.5">
                  <span className={s.active ? 'text-(--color-signal-good)' : 'text-muted'}>
                    {s.active ? 'ativo' : 'inativo'}
                  </span>
                </td>
              </tr>
            ))}
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted p-6 text-center">
                  Nenhum profissional cadastrado ainda.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminShell>
  )
}
