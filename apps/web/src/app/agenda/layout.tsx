import { OperateTopbar } from '@/components/operate/topbar'
import { requireStaffSession } from '@/server/auth/session'

export default async function AgendaLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaffSession()
  return (
    <>
      <OperateTopbar session={session} active="/agenda" />
      {children}
    </>
  )
}
