import Link from 'next/link'
import { AdminShell, Section } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { formatBRL, formatDuration } from '@/lib/format'
import { href } from '@/lib/utils'
import { listCategories, listServicesAdmin } from '@/server/admin/services'
import { requireRede } from '@/server/auth/permissoes'
import { criarCategoria } from './actions'

/** As ressalvas de um serviço, em ordem de quem tropeça nelas primeiro. */
function ressalvas(s: { onlineBookable: boolean; requiresAssessment: boolean }): string[] {
  const lista: string[] = []
  if (!s.onlineBookable) lista.push('só recepção')
  if (s.requiresAssessment) lista.push('avaliação')
  return lista
}

export default async function ServicosPage() {
  const acesso = await requireRede()
  const [services, categories] = await Promise.all([listServicesAdmin(), listCategories()])

  const byCategory = new Map<string, typeof services>()
  for (const service of services) {
    const key = service.categoryName ?? 'Sem categoria'
    byCategory.set(key, [...(byCategory.get(key) ?? []), service])
  }

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/servicos"
      title="Serviços"
      subtitle="Catálogo da rede: preço, duração composta, sinal e quem pode executar."
      actions={
        <Link href="/admin/servicos/novo">
          <Button size="sm">+ novo serviço</Button>
        </Link>
      }
    >
      {/*
        Uma tabela só para o catálogo inteiro, e não uma por categoria.
        Cada tabela dimensiona as próprias colunas: com cinco tabelas
        empilhadas, o preço de "Escova" caía num lugar e o de "Mechas" em
        outro, e a tabela de preços de um salão existe justamente para ser
        lida na vertical. A categoria vira uma linha de intertítulo dentro da
        mesma grade — a coluna continua sendo uma coluna.
      */}
      {services.length === 0 ? (
        <p className="text-muted">Nenhum serviço cadastrado ainda.</p>
      ) : (
        <div className="surface rounded-card mb-5 overflow-x-auto">
          <table className="w-full min-w-3xl text-sm">
            {/*
              O preço fecha a linha. Ele era a terceira de quatro colunas, com
              as ressalvas depois — e uma tabela de preços em que o preço não é
              a última coisa da linha obriga a voltar o olho para achá-lo. As
              ressalvas ("só recepção", "avaliação") pertencem ao serviço, não
              a uma coluna própria: viraram legenda embaixo do nome, onde só
              ocupam altura nas poucas linhas que as têm.
            */}
            <colgroup>
              <col />
              <col className="w-44" />
              <col className="w-32" />
            </colgroup>
            <thead className="sr-only">
              <tr>
                <th>Serviço</th>
                <th>Duração</th>
                <th>Preço</th>
              </tr>
            </thead>
            {[...byCategory.entries()].map(([categoryName, rows]) => (
              <tbody key={categoryName}>
                <tr>
                  <th
                    colSpan={3}
                    scope="colgroup"
                    className="text-muted border-y border-(--border-subtle) bg-(--surface-sunken) px-4 py-2 text-left text-xs font-medium"
                  >
                    {categoryName}
                  </th>
                </tr>
                {rows.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-(--border-subtle) last:border-0 hover:bg-(--surface-sunken)"
                  >
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={href(`/admin/servicos/${s.id}`)}
                        className="font-medium hover:underline"
                      >
                        {s.name}
                      </Link>
                      {!s.active ? <span className="text-muted ml-2 text-xs">inativo</span> : null}
                      {ressalvas(s).length > 0 ? (
                        <p className="text-muted mt-0.5 text-xs">{ressalvas(s).join(' · ')}</p>
                      ) : null}
                    </td>
                    <td className="text-muted tnum px-4 py-3 align-top whitespace-nowrap">
                      {formatDuration(s.setupMin + s.processingMin + s.finishMin)}
                    </td>
                    <td className="tnum px-4 py-3 text-right align-top font-medium whitespace-nowrap">
                      {formatBRL(s.basePrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}

      <Section title="Categorias" hint="Organizam o catálogo na tela de agendamento.">
        <ul className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-full border border-(--border-subtle) px-3 py-1 text-sm">
              {c.name}
            </li>
          ))}
        </ul>
        <form action={criarCategoria} className="flex gap-2">
          <input className="field max-w-xs" name="name" placeholder="Nome da categoria" required />
          <Button type="submit" variant="outline" size="sm">
            + adicionar
          </Button>
        </form>
      </Section>
    </AdminShell>
  )
}
