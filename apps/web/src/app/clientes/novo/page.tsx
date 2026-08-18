import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ErroDoForm } from '@/components/ui/erro-do-form'
import { FormComEstado } from '@/components/ui/form-com-estado'
import { PhoneInput } from '@/components/ui/phone-input'
import { pais } from '@/lib/pais'
import { href } from '@/lib/utils'
import { listUnitsAdmin } from '@/server/admin/units'
import { requireGestao, unidadesVisiveis } from '@/server/auth/permissoes'
import { criarCliente } from './actions'

export const metadata = { title: 'Nova cliente' }

/**
 * A ficha que nasce ao balcão.
 *
 * Até aqui a cliente só entrava por dois caminhos: a marcação online, e a
 * importação de CSV. Faltava o terceiro, que é o mais comum de todos — alguém
 * ao telefone a marcar pela primeira vez, com a recepção a escrever enquanto
 * ouve. Sem ele, a recepção marcava no nome de outra pessoa ou desligava para ir
 * montar um CSV de uma linha.
 *
 * Quatro campos e nada mais. O resto da ficha — nascimento, documento, como
 * conheceu, preferências, etiquetas, observações — abre logo a seguir, na ficha
 * a que este formulário leva, e ao telefone ninguém preenche nada disso.
 */
export default async function NovaClientePage() {
  const acesso = await requireGestao()
  /* Só as lojas de quem abriu: a unidade preferida é uma casa onde ela vai ser
     esperada, e um gerente não escala expectativa na loja do outro. */
  const units = unidadesVisiveis(acesso, await listUnitsAdmin())

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href={href('/clientes')} className="text-muted text-sm hover:underline">
        ← clientes
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">Nova cliente</h1>
        <p className="text-muted mt-1 text-sm">
          Nome e {pais().rotulos.telemovel.toLowerCase()} bastam. Se este número já estiver
          registado, isto abre a ficha que já existe em vez de criar uma segunda.
        </p>
      </header>

      <div className="surface rounded-card p-5">
        <FormComEstado action={criarCliente} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Nome
            <input className="field" name="name" autoComplete="name" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {pais().rotulos.telemovel}
            {/* O mesmo campo com máscara da marcação e do login: escrito à mão,
                o número saía num formato que `toE164` recusa. */}
            <PhoneInput className="field" name="phone" required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input className="field" name="email" type="email" autoComplete="email" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Unidade preferida
            <select className="field" name="preferredUnitId" defaultValue="">
              <option value="">—</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit">Criar ficha</Button>
            <ErroDoForm className="text-sm text-(--estado-mau)" />
          </div>
        </FormComEstado>
      </div>
    </div>
  )
}
