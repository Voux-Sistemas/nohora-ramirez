import { OperateTopbar } from '@/components/operate/topbar'
import { requireGestao } from '@/server/auth/permissoes'

/*
  Gestão passa por aqui; cada tela de dentro aperta mais.
  O gerente cuida da equipa das lojas dele — é o que "gerenciar a unidade"
  quer dizer na prática. Unidades, catálogo de serviços e comissões são da
  rede: mexer neles muda as três lojas de uma vez, e isso é decisão da dona.
*/
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const acesso = await requireGestao()
  return (
    <>
      <OperateTopbar acesso={acesso} active="cadastros" />
      {children}
    </>
  )
}
