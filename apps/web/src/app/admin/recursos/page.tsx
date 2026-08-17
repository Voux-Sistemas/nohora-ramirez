import { AdminShell, Section } from '@/components/admin/shell'
import { Estado } from '@/components/admin/estado'
import { Button } from '@/components/ui/button'
import { ErroDoForm } from '@/components/ui/erro-do-form'
import { FormComEstado } from '@/components/ui/form-com-estado'
import {
  listResourceAssignables,
  listResourcesAdmin,
  listResourceTypes,
} from '@/server/admin/resources'
import { podeSuporte, requireGestao } from '@/server/auth/permissoes'
import { alternarRecurso, criarRecurso, criarTipoRecurso } from './actions'

/**
 * Recursos: o gerente cuida das cabines da loja dele; o tipo de cabine é da
 * instalação. Por isso a tela abre para os dois degraus de gestão, mas o
 * cadastro de tipo — que muda o vocabulário das lojas todas e não tem volta —
 * fica com o suporte.
 *
 * Em ecrã largo, as instâncias ficam à esquerda e os tipos à direita: são o
 * vocabulário de que a lista da esquerda depende, e ter de rolar até ao fundo
 * para consultar o vocabulário era um vaivém sem motivo.
 */
export default async function RecursosPage() {
  const acesso = await requireGestao()
  const suporte = podeSuporte(acesso)
  const [types, resources, assignables] = await Promise.all([
    listResourceTypes(),
    listResourcesAdmin(acesso.unidadeIds),
    listResourceAssignables(acesso.unidadeIds),
  ])
  const ativos = resources.filter((r) => r.active).length

  return (
    <AdminShell
      acesso={acesso}
      active="/admin/recursos"
      title="Recursos"
      meta={resources.length > 0 ? `${resources.length} recursos · ${ativos} ativos` : undefined}
    >
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start">
        <Section
          title="Instâncias"
          hint="Cada linha é um recurso físico de verdade — duas cabines são duas linhas."
          className="mb-0"
        >
          {resources.length === 0 ? (
            <p className="text-muted plate mb-4 p-10 text-center text-sm">
              Nenhum recurso registado ainda.
            </p>
          ) : (
            <div className="plate mb-4 overflow-x-auto">
              <table className="w-full min-w-2xl text-[0.9375rem]">
                <thead className="text-muted border-b border-(--border-subtle) text-left">
                  <tr>
                    <th className="px-5 py-3 font-medium">Nome</th>
                    <th className="px-5 py-3 font-medium">Unidade</th>
                    <th className="px-5 py-3 font-medium">Tipo</th>
                    <th className="px-5 py-3 text-right font-medium">Prior.</th>
                    <th className="px-5 py-3 font-medium">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {resources.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-(--border-subtle) transition-colors last:border-0 hover:bg-(--surface-sunken)"
                    >
                      <td className="px-5 py-3 font-medium">{r.name}</td>
                      <td className="text-muted px-5 py-3">{r.unitName}</td>
                      <td className="text-muted px-5 py-3">{r.resourceTypeName}</td>
                      <td className="text-muted tnum px-5 py-3 text-right">{r.priority}</td>
                      <td className="px-5 py-3">
                        <Estado ativo={r.active} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        <form action={alternarRecurso}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="name" value={r.name} />
                          <input type="hidden" name="unitId" value={r.unitId} />
                          <input type="hidden" name="resourceTypeId" value={r.resourceTypeId} />
                          <input type="hidden" name="priority" value={r.priority} />
                          <input type="hidden" name="active" value={String(r.active)} />
                          <Button type="submit" variant="ghost" size="sm">
                            {r.active ? 'desativar' : 'ativar'}
                          </Button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <FormComEstado action={criarRecurso} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <input className="field" name="name" placeholder="Nome (ex.: Cabine 1)" required />
            <select className="field" name="unitId" required defaultValue="">
              <option value="" disabled>
                Unidade
              </option>
              {assignables.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select className="field" name="resourceTypeId" required defaultValue="">
              <option value="" disabled>
                Tipo
              </option>
              {assignables.resourceTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              className="field"
              type="number"
              name="priority"
              placeholder="Prioridade"
              defaultValue={0}
            />
            <Button type="submit" variant="outline">
              + adicionar
            </Button>
            <ErroDoForm className="col-span-2 text-sm text-(--estado-mau) lg:col-span-5" />
          </FormComEstado>
        </Section>

        <Section title="Tipos" className="mb-0 xl:sticky xl:top-8">
          <ul className="mb-4 flex flex-col">
            {types.map((t) => (
              <li
                key={t.id}
                className="flex items-baseline justify-between gap-3 border-b border-(--border-subtle) py-2 text-sm"
              >
                <span className="min-w-0 truncate">{t.name}</span>
                <span className="text-muted tnum shrink-0 text-xs">{t.unitCount}</span>
              </li>
            ))}
            {types.length === 0 ? (
              <li className="text-muted text-sm">Nenhum tipo registado ainda.</li>
            ) : null}
          </ul>
          {suporte ? (
            <FormComEstado action={criarTipoRecurso} className="flex flex-col gap-2">
              <input className="field" name="name" placeholder="Ex.: Cabine, Lavatório" required />
              <Button type="submit" variant="outline" size="sm">
                + adicionar tipo
              </Button>
              <ErroDoForm className="text-sm text-(--estado-mau)" />
            </FormComEstado>
          ) : (
            <p className="text-muted text-sm">
              Um tipo novo muda todas as lojas de uma vez e não tem como apagar depois — quem cria é
              o suporte. Mais uma cabine do tipo que já existe é aqui ao lado.
            </p>
          )}
        </Section>
      </div>
    </AdminShell>
  )
}
