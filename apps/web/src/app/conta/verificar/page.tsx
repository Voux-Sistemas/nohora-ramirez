import { redirect } from 'next/navigation'
import { CodeForm } from '@/components/auth/code-form'
import { formatPhone } from '@/lib/format'

export const metadata = { title: 'Verificar código' }

/*
  `para` vem da URL, e URL qualquer um escreve. Só passa o que tem a cara do
  mascaramento que nós mesmos geramos — assim ninguém monta um link que diz à
  cliente que o código foi para o e-mail de outra pessoa.
*/
function destinoValido(para: string | undefined): string | undefined {
  if (!para) return undefined
  return /^[^\s@]{1,2}•+@[^\s@]+\.[^\s@]+$/.test(para) ? para : undefined
}

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string; para?: string; dev?: string }>
}) {
  const { telefone, para, dev } = await searchParams
  if (!telefone) redirect('/conta/entrar')

  const destino = destinoValido(para)

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Digite o código</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        {destino ? (
          <>
            Enviamos um código para <span className="text-body">{destino}</span>, o e-mail da conta{' '}
            {formatPhone(telefone)}. Ele vale por 5 minutos.
          </>
        ) : (
          <>Enviamos um código para a conta {formatPhone(telefone)}.</>
        )}
      </p>
      {dev ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Modo desenvolvimento — código: <span className="font-mono font-semibold">{dev}</span>
        </p>
      ) : null}
      <div className="surface rounded-card p-5">
        <CodeForm telefone={telefone} />
      </div>
    </div>
  )
}
