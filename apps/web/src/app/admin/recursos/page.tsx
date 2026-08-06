import { AdminShell, Section } from '@/components/admin/shell'
import { Button } from '@/components/ui/button'
import { listResourceAssignables, listResourcesAdmin, listResourceTypes } from '@/server/admin/resources'
import { alternarRecurso, criarRecurso, criarTipoRecurso } from './actions'

export default async function RecursosPage() {
  const [types, resources, assignables] = await Promise.all([
    listResourceTypes(),
    listResourcesAdmin(),
    listResourceAssignables(),
  ])

  return (
    <AdminShell
      active="/admin/recursos"
      title="Recursos"
      subtitle="Cabines, lavatórios, macas e equipamentos que a agenda reserva junto com o profissional."
    >
      <Section title="Tipos de recurso" hint="São da rede — o mesmo tipo vale nas três lojas.">
        <ul className="mb-4 flex flex-wrap gap-2">
          {types.map((t) => (
            <li key={t.id} className="rounded-full border border-(--border-subtle) px-3 py-1 text-sm">
              {t.name} <span className="text-muted">· {t.unitCount} instância(s)</span>
            </li>
          ))}
          {types.length === 0 ? <li className="text-muted text-sm">Nenhum tipo cadastrado ainda.</li> : null}
        </ul>
        <form action={criarTipoRecurso} className="flex gap-2">
          <input className="field max-w-xs" name="name" placeholder="Ex.: Cabine, Lavatório" required />
          <Button type="submit" variant="outline" size="sm">
            + adicionar tipo
          </Button>
        </form>
      </Section>

      <Section title="Instâncias" hint="Cada linha é um recurso físico de verdade — duas cabines são duas linhas.">
        <div className="surface rounded-card mb-4 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted border-b border-(--border-subtle) text-left">
              <tr>
                <th className="p-3 font-medium">Nome</th>
                <th className="p-3 font-medium">Unidade</th>
                <th className="p-3 font-medium">Tipo</th>
                <th className="p-3 font-medium">Prioridade</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id} className="border-b border-(--border-subtle) last:border-0">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="text-muted p-3">{r.unitName}</td>
                  <td className="text-muted p-3">{r.resourceTypeName}</td>
                  <td className="text-muted p-3">{r.priority}</td>
                  <td className="p-3">
                    <span className={r.active ? 'text-green-700 dark:text-green-400' : 'text-muted'}>
                      {r.active ? 'ativo' : 'inativo'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
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
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted p-6 text-center">
                    Nenhum recurso cadastrado ainda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form action={criarRecurso} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <input className="field" type="number" name="priority" placeholder="Prioridade" defaultValue={0} />
          <div className="col-span-2 sm:col-span-4">
            <Button type="submit" variant="outline" size="sm">
              + adicionar recurso
            </Button>
          </div>
        </form>
      </Section>
    </AdminShell>
  )
}
