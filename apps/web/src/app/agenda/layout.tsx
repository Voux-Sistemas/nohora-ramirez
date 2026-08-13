import { OperateTopbar } from '@/components/operate/topbar'
import { requireAcesso } from '@/server/auth/permissoes'

/* A agenda é a única seção que os três degraus abrem. O que muda é o que cada
   um enxerga dentro dela, e isso é decidido tela a tela. */
export default async function AgendaLayout({ children }: { children: React.ReactNode }) {
  const acesso = await requireAcesso()
  return (
    <div data-theme="light" className="contents">
      <OperateTopbar acesso={acesso} active="agenda" />
      {children}
    </div>
  )
}
