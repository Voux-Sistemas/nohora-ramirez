import { OperateTopbar } from '@/components/operate/topbar'
import { requireGestao } from '@/server/auth/permissoes'

/* Caixa é dinheiro da loja, não da cadeira: quem atende não entra. */
export default async function CaixaLayout({ children }: { children: React.ReactNode }) {
  const acesso = await requireGestao()
  return (
    <>
      <OperateTopbar acesso={acesso} active="caixa" />
      {children}
    </>
  )
}
