import Link from 'next/link'
import { StaffLoginForm } from '@/components/auth/staff-login-form'
import { href } from '@/lib/utils'

export const metadata = { title: 'Entrar — equipa' }

/**
 * A entrada da equipa.
 *
 * O destino padrão é `/painel`, e não uma tela de cadastro: quem entra de manhã
 * quer ver o dia. Quem chegou aqui empurrado por um porteiro de tela volta ao
 * sítio de onde veio, por `?destino=`.
 */
export default async function EntrarEquipaPage({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams

  return (
    <>
      <h1 className="display display-md">Área da equipa</h1>
      <div className="rule-bronze mt-4 w-12" />
      <p className="text-body mt-5 mb-7 text-[0.9375rem] leading-relaxed">
        Agenda, clientes, caixa e gestão. Entre com o telemóvel que está no seu cadastro.
      </p>

      <StaffLoginForm destino={destino ?? '/painel'} />

      <p className="text-muted mt-8 border-t border-(--border-subtle) pt-6 text-[0.8125rem]">
        <Link
          href={href('/entrar/equipa/esqueci')}
          className="text-(--text-strong) underline underline-offset-4"
        >
          Esqueci-me da senha
        </Link>
        <span className="mx-2">·</span>
        <Link href={href('/entrar')} className="hover:text-(--text-strong)">
          Sou cliente
        </Link>
      </p>
    </>
  )
}
