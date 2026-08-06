import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import { listStaffAdmin } from '@/server/admin/staff'

export default async function EquipePage() {
  const staff = await listStaffAdmin()

  return (
    <AdminShell
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
        <table className="w-full text-sm">
          <thead className="text-muted border-b border-(--border-subtle) text-left">
            <tr>
              <th className="p-3 font-medium">Nome</th>
              <th className="p-3 font-medium">Telefone</th>
              <th className="p-3 font-medium">Unidades</th>
              <th className="p-3 font-medium">Online</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr
                key={s.id}
                className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
              >
                <td className="p-3">
                  <Link href={href(`/admin/equipe/${s.id}`)} className="flex items-center gap-2 font-medium hover:underline">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </Link>
                </td>
                <td className="p-3">{formatPhone(s.phone)}</td>
                <td className="text-muted p-3">{s.unitNames.join(', ') || '—'}</td>
                <td className="p-3">{s.acceptsOnlineBooking ? 'sim' : 'não'}</td>
                <td className="p-3">
                  <span className={s.active ? 'text-green-700 dark:text-green-400' : 'text-muted'}>
                    {s.active ? 'ativo' : 'inativo'}
                  </span>
                </td>
              </tr>
            ))}
            {staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-muted p-6 text-center">
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
