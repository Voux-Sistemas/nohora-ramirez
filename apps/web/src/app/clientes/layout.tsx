import { OperateTopbar } from '@/components/operate/topbar'
import { requireStaffSession } from '@/server/auth/session'

export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession()
  return (
    <>
      <OperateTopbar session={session} active="/clientes" />
      {children}
    </>
  )
}
