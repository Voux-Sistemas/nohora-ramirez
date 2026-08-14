import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Estado } from '@/components/admin/estado'
import { PapelChip } from '@/components/admin/papel-chip'
import { Button } from '@/components/ui/button'
import { href } from '@/lib/utils'
import { listStaffAdmin } from '@/server/admin/staff'
import { requireGestao } from '@/server/auth/permissoes'

/**
 * A lista já vem recortada: o gerente do Centro não abre a ficha de quem só
 * atende no Jardins. Telefone e "aceita online" moram na ficha — na lista não
 * decidem nada de relance, só ocupavam uma coluna.
 */
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
      {staff.length === 0 ? (
        <p className="text-muted p-6 text-center text-sm">Nenhum profissional cadastrado ainda.</p>
      ) : (
        <div className="surface rounded-card overflow-hidden">
          {/* sm+: tabela. Abaixo disso, cartão de duas linhas — sem rolagem lateral. */}
          <table className="hidden w-full text-[0.9375rem] sm:table">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="p-3.5 font-medium">Nome</th>
                <th className="p-3.5 font-medium">Unidades</th>
                <th className="p-3.5 font-medium">Papel</th>
                <th className="p-3.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
                >
                  <td className="p-3.5">
                    <Link
                      href={href(`/admin/equipe/${s.id}`)}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-muted p-3.5">{s.unitNames.join(', ') || '—'}</td>
                  <td className="p-3.5">
                    <PapelChip papel={s.papel} />
                  </td>
                  <td className="p-3.5">
                    <Estado ativo={s.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="sm:hidden">
            {staff.map((s) => (
              <li key={s.id} className="border-b border-(--border-subtle) p-3.5 last:border-0">
                <Link href={href(`/admin/equipe/${s.id}`)} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{s.name}</span>
                  </span>
                  <Estado ativo={s.active} />
                </Link>
                <div className="mt-1.5 flex items-center gap-2 pl-[1.125rem]">
                  <span className="text-muted min-w-0 flex-1 truncate text-sm">
                    {s.unitNames.join(', ') || '—'}
                  </span>
                  <PapelChip papel={s.papel} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminShell>
  )
}
