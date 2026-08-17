import Link from 'next/link'
import { AdminShell, Section } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { ErroDoForm } from '@/components/ui/erro-do-form'
import { FormComEstado } from '@/components/ui/form-com-estado'
import { formatMoney, formatDuration } from '@/lib/format'
import { href } from '@/lib/utils'
import { listCategories, listServicesAdmin } from '@/server/admin/services'
import { requireRede } from '@/server/auth/permissoes'
import { criarCategoria } from './actions'

/** As ressalvas de um serviço, em ordem de quem tropeça nelas primeiro. */
function ressalvas(s: { onlineBookable: boolean; requiresAssessment: boolean }): string[] {
  const lista: string[] = []
  if (!s.onlineBookable) lista.push('só receção')
  if (s.requiresAssessment) lista.push('avaliação')
  return lista
}

/**
 * Âncora para saltar da lista de categorias para o trecho da tabela.
 *
 * Acento vira hífen em vez de ser desacentuado: o alvo é um `id` de HTML que
 * só precisa de ser determinístico dentro da própria página, e uma tabela de
 * regex de diacríticos aqui seria peso para não resolver nada.
 */
function ancora(nome: string): string {
  return `cat-${nome
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

export default async function ServicosPage() {
  const acesso = await requireRede()
  const [services, categories] = await Promise.all([listServicesAdmin(), listCategories()])

  const byCategory = new Map<string, typeof services>()
  for (const service of services) {
    const key = service.categoryName ?? 'Sem categoria'
    byCategory.set(key, [...(byCategory.get(key) ?? []), service])
  }
  const ativos = services.filter((s) => s.active).length

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/servicos"
      title="Serviços"
      meta={
        services.length > 0
          ? `${services.length} serviços · ${ativos} ativos · ${byCategory.size} categorias`
          : undefined
      }
      actions={
        <Link href="/admin/servicos/novo">
          <Button size="sm">+ novo serviço</Button>
        </Link>
      }
    >
      {/*
        O catálogo à esquerda e as categorias à direita, lado a lado. Antes as
        categorias eram um bloco no fim de quarenta linhas de tabela — para
        acrescentar uma, a dona rolava o catálogo inteiro. Agora são também o
        índice: cada uma salta para o seu trecho da tabela.
      */}
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_16rem] xl:items-start">
        <Section title="Catálogo" className="mb-0">
          {services.length === 0 ? (
            <p className="text-muted plate p-10 text-center text-sm">
              Nenhum serviço registado ainda.
            </p>
          ) : (
            <div className="plate overflow-x-auto">
              {/*
                Uma tabela só para o catálogo inteiro, e não uma por categoria.
                Cada tabela dimensiona as próprias colunas: com cinco tabelas
                empilhadas, o preço de "Escova" caía num lugar e o de "Mechas"
                em outro, e a tabela de preços de um salão existe justamente
                para ser lida na vertical. A categoria vira uma linha de
                intertítulo dentro da mesma grade.
              */}
              <table className="w-full min-w-2xl text-[0.9375rem]">
                {/*
                  O preço fecha a linha. As ressalvas ("só receção",
                  "avaliação") pertencem ao serviço, não a uma coluna própria:
                  são legenda debaixo do nome, onde só ocupam altura nas poucas
                  linhas que as têm.
                */}
                <colgroup>
                  <col />
                  <col className="w-40" />
                  <col className="w-36" />
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
                        id={ancora(categoryName)}
                        className="text-muted label-caps border-y border-(--border-subtle) bg-(--surface-sunken) px-5 py-2 text-left scroll-mt-6"
                      >
                        {categoryName}
                      </th>
                    </tr>
                    {rows.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-(--border-subtle) transition-colors last:border-0 hover:bg-(--surface-sunken)"
                      >
                        <td className="px-5 py-3.5 align-top">
                          <Link
                            href={href(`/admin/servicos/${s.id}`)}
                            className="font-medium hover:underline"
                          >
                            {s.name}
                          </Link>
                          {!s.active ? (
                            <span className="text-muted ml-2 text-xs">inativo</span>
                          ) : null}
                          {ressalvas(s).length > 0 ? (
                            <p className="text-muted mt-0.5 text-xs">{ressalvas(s).join(' · ')}</p>
                          ) : null}
                        </td>
                        <td className="text-muted tnum px-5 py-3.5 align-top whitespace-nowrap">
                          {formatDuration(s.setupMin + s.processingMin + s.finishMin)}
                        </td>
                        <td className="tnum px-5 py-3.5 text-right align-top font-medium whitespace-nowrap">
                          {formatMoney(s.basePrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          )}
        </Section>

        <Section title="Categorias" className="mb-0 xl:sticky xl:top-8">
          <ul className="mb-4 flex flex-col">
            {categories.map((c) => {
              const quantos = byCategory.get(c.name)?.length ?? 0
              return (
                <li key={c.id}>
                  <a
                    href={`#${ancora(c.name)}`}
                    className="text-muted hover:text-(--text-strong) flex items-baseline justify-between gap-3 border-b border-(--border-subtle) py-2 text-sm transition-colors"
                  >
                    <span className="min-w-0 truncate">{c.name}</span>
                    <span className="tnum shrink-0 text-xs">{quantos}</span>
                  </a>
                </li>
              )
            })}
            {categories.length === 0 ? (
              <li className="text-muted text-sm">Nenhuma categoria ainda.</li>
            ) : null}
          </ul>
          <FormComEstado action={criarCategoria} className="flex flex-col gap-2">
            <input className="field" name="name" placeholder="Nome da categoria" required />
            <Button type="submit" variant="outline" size="sm">
              + adicionar
            </Button>
            <ErroDoForm className="text-sm text-(--estado-mau)" />
          </FormComEstado>
        </Section>
      </div>
    </AdminShell>
  )
}
