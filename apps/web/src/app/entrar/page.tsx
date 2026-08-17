import Link from 'next/link'
import { redirect } from 'next/navigation'
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
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="text-muted mt-1 mb-6 text-sm">Acesso da equipa — agenda, caixa e registos.</p>
      <div className="surface rounded-card p-5">
        {/* `/` e não `/admin`: a raiz é quem sabe o início de cada degrau, e
            mandar todos para a gestão fazia a profissional entrar e ser
            expulsa de lá no mesmo instante. */}
        <StaffLoginForm next={next ?? '/'} />
      </div>
      <Link className="text-muted mt-6 text-sm underline underline-offset-4" href="/entrar/esqueci">
        Esqueci-me da palavra-passe
      </Link>
    </div>
  )
}
