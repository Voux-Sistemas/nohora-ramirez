import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Estado } from '@/components/admin/estado'
import { PapelChip } from '@/components/admin/papel-chip'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import { listStaffAdmin } from '@/server/admin/staff'
import { requireGestao } from '@/server/auth/permissoes'

/**
 * A equipe já vem recortada: o gerente do Valongo não abre a ficha de quem só
 * atende na Maia.
 *
 * O telefone tinha saído da lista quando ela era desenhada para caber num
 * telemóvel. Num ecrã de computador a coluna cabe de sobra, e uma lista de
 * equipe é também a agenda de contactos de quem gere — tirá-la custava um
 * clique a cada vez que a dona precisa ligar para alguém.
 */
export default async function EquipePage() {
  const acesso = await requireGestao()
  const staff = await listStaffAdmin(acesso.unidadeIds)
  const ativos = staff.filter((s) => s.active).length

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/equipe"
      title="Equipa"
      meta={staff.length > 0 ? `${staff.length} pessoas · ${ativos} ativas` : undefined}
      actions={
        <Link href="/admin/equipe/novo">
          <Button size="sm">+ novo profissional</Button>
        </Link>
      }
    >
      {staff.length === 0 ? (
        <p className="text-muted plate p-10 text-center text-sm">
          Nenhum profissional registado ainda.
        </p>
      ) : (
        <div className="plate overflow-x-auto">
          <table className="w-full min-w-3xl text-[0.9375rem]">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Unidades</th>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-5 py-3 font-medium">Papel</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-(--border-subtle) transition-colors last:border-0 hover:bg-(--surface-sunken)"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={href(`/admin/equipe/${s.id}`)}
                      className="flex items-center gap-2.5 font-medium hover:underline"
                    >
                      {/* a mesma cor que a marca a agenda — reconhece-se a
                          pessoa antes de ler o nome */}
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-muted px-5 py-3.5">{s.unitNames.join(', ') || '—'}</td>
                  <td className="text-muted tnum px-5 py-3.5 whitespace-nowrap">
                    {s.phone ? formatPhone(s.phone) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <PapelChip papel={s.papel} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Estado ativo={s.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}
