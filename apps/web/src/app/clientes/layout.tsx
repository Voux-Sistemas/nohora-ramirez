import { OperateTopbar } from '@/components/operate/topbar'
import { requireGestao } from '@/server/auth/permissoes'

/* A carteira é da rede inteira — nome, telefone e histórico de todo mundo. Quem
   atende vê a cliente do próprio horário pela ficha do atendimento, não aqui. */
export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  const acesso = await requireGestao()
  return (
    <>
      <OperateTopbar acesso={acesso} active="clientes" />
      {children}
    </>
  )
}
