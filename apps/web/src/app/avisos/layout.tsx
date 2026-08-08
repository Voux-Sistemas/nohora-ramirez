import { OperateTopbar } from '@/components/operate/topbar'
import { requireGestao } from '@/server/auth/permissoes'

/*
  Avisos era a única seção da barra sem barra: quem entrava aqui ficava sem o
  caminho de volta e tinha de usar o botão do navegador. Agora tem, como as
  outras — e com o mesmo porteiro, porque a fila mostra o telefone das clientes
  do dia inteiro e falar em nome da loja é da gestão.
*/
export default async function AvisosLayout({ children }: { children: React.ReactNode }) {
  const acesso = await requireGestao()
  return (
    <>
      <OperateTopbar acesso={acesso} active="avisos" />
      {children}
    </>
  )
}
