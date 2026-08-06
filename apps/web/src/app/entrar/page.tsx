import { StaffLoginForm } from '@/components/auth/staff-login-form'

export const metadata = { title: 'Entrar' }

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="text-muted mt-1 mb-6 text-sm">Acesso da equipe — agenda, caixa e cadastros.</p>
      <div className="surface rounded-card p-5">
        <StaffLoginForm next={next ?? '/admin'} />
      </div>
    </div>
  )
}
