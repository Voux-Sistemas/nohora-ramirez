import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Porta } from '@/components/auth/porta'
import { StaffLoginForm } from '@/components/auth/staff-login-form'
import { acessoDe, inicio } from '@/server/auth/permissoes'
import { getSession } from '@/server/auth/session'

export const metadata = { title: 'Entrar' }

/**
 * A porta da equipa — e o único endereço que a equipa precisa de decorar.
 *
 * Quem já entrou não vê formulário: `/entrar` leva-o ao seu início. É isso que
 * torna este endereço um marcador de navegador — a dona abre `/entrar` de manhã
 * e cai no dia da rede; a profissional abre o mesmo e cai na agenda dela. Antes,
 * a porta da equipa era a raiz; mas a raiz é o link do salão, e ali tem de estar
 * a montra, não um pedido de senha.
 *
 * Sessão sem papel de equipa — a cliente — continua a ver o formulário. Ela não
 * está no lugar errado: pode ser gente da casa a entrar aqui pela primeira vez.
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const session = await getSession()
  const acesso = session ? await acessoDe(session) : null
  if (acesso) redirect(inicio(acesso))

  const { next } = await searchParams

  return (
    <Porta
      title="Entrar"
      subtitle="Acesso da equipa — agenda, caixa e registos."
      footer={
        <Link
          className="underline underline-offset-4 hover:text-(--text-strong)"
          href="/entrar/esqueci"
        >
          Esqueci-me da palavra-passe
        </Link>
      }
    >
      <div className="surface rounded-card p-5">
        {/* `/` e não `/admin`: a raiz é quem sabe o início de cada degrau, e
            mandar todos para a gestão fazia a profissional entrar e ser
            expulsa de lá no mesmo instante. */}
        <StaffLoginForm next={next ?? '/'} />
      </div>
    </Porta>
  )
}
