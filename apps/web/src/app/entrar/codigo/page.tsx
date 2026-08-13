import { redirect } from 'next/navigation'
import { CodeForm } from '@/components/auth/code-form'
import { formatPhone } from '@/lib/format'

export const metadata = { title: 'Código de entrada' }

/*
  `para` vem do endereço, e endereço qualquer um escreve. Só passa o que tem a
  cara do mascaramento que nós próprios geramos — assim ninguém monta um link
  que diz à cliente que o código foi para o e-mail de outra pessoa.
*/
function destinoValido(para: string | undefined): string | undefined {
  if (!para) return undefined
  return /^[^\s@]{1,2}•+@[^\s@]+\.[^\s@]+$/.test(para) ? para : undefined
}

export default async function CodigoPage({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string; para?: string; dev?: string }>
}) {
  const { telefone, para, dev } = await searchParams
  if (!telefone) redirect('/entrar')

  const destino = destinoValido(para)

  return (
    <>
      <h1 className="display display-md">Escreva o código</h1>
      <div className="rule-bronze mt-4 w-12" />
      <p className="text-body mt-5 mb-7 text-[0.9375rem] leading-relaxed">
        {destino ? (
          <>
            Enviámos um código para <span className="text-(--text-strong)">{destino}</span>, o
            e-mail da conta <span className="tnum">{formatPhone(telefone)}</span>. Vale por cinco
            minutos.
          </>
        ) : (
          <>
            Enviámos um código para a conta{' '}
            <span className="tnum">{formatPhone(telefone)}</span>.
          </>
        )}
      </p>

      {dev ? (
        <p className="rounded-plate mb-5 border border-(--accent)/40 bg-(--accent-wash) px-4 py-3 text-sm text-(--accent-ink)">
          Ambiente de teste — o código é{' '}
          <span className="tnum font-semibold tracking-[0.16em]">{dev}</span>
        </p>
      ) : null}

      <CodeForm telefone={telefone} />
    </>
  )
}
