import Link from 'next/link'
import { AdminShell } from '@/components/admin/shell'
import { Estado } from '@/components/admin/estado'
import { Button } from '@/components/ui/button'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import { listUnitsAdmin } from '@/server/admin/units'
import { podeSuporte, requireRede } from '@/server/auth/permissoes'

/**
 * As lojas da rede.
 *
 * A lista tinha duas versões — tabela em `sm+` e cartões empilhados abaixo
 * disso — e era metade do ficheiro. A gestão é de computador: fica a tabela,
 * com a morada de volta (havia largura para ela o tempo todo) e rolagem
 * lateral como saída de emergência num ecrã pequeno.
 */
export default async function UnidadesPage() {
  const acesso = await requireRede()
  const units = await listUnitsAdmin()
  const ativas = units.filter((u) => u.active).length

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/unidades"
      title="Unidades"
      meta={units.length > 0 ? `${units.length} lojas · ${ativas} ativas` : undefined}
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
        <p className="text-muted plate p-10 text-center text-sm">
          Nenhuma unidade registada ainda.
        </p>
      ) : (
        <div className="plate overflow-x-auto">
          <table className="w-full min-w-3xl text-[0.9375rem]">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">Morada</th>
                <th className="px-5 py-3 font-medium">Telefone</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-(--border-subtle) transition-colors last:border-0 hover:bg-(--surface-sunken)"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={href(`/admin/unidades/${u.id}`)}
                      className="font-medium hover:underline"
                    >
                      {u.name}
                    </Link>
                    <div className="text-muted text-xs">/{u.slug}</div>
                  </td>
                  <td className="text-muted px-5 py-3.5">
                    {u.addressLine ? (
                      <>
                        {u.addressLine}
                        {u.city ? <span className="text-muted"> · {u.city}</span> : null}
                      </>
                    ) : (
                      (u.city ?? '—')
                    )}
                  </td>
                  <td className="text-muted tnum px-5 py-3.5 whitespace-nowrap">
                    {u.phone ? formatPhone(u.phone) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <Estado ativo={u.active} ligado="ativa" desligado="inativa" />
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
