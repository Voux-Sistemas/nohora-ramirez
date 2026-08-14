import { redirect } from 'next/navigation'
import { NovaSenhaForm } from '@/components/auth/recuperacao-forms'
import { formatPhone } from '@/lib/format'

export const metadata = { title: 'Nova palavra-passe' }

/*
  `para` vem da URL, e URL qualquer um escreve. Só passa o que tem a cara do
  mascaramento que nós mesmos geramos — assim ninguém monta um link dizendo
  que o código foi para a caixa de outra pessoa.
*/
function destinoValido(para: string | undefined): string | undefined {
  if (!para) return undefined
  return /^[^\s@]{1,2}•+@[^\s@]+\.[^\s@]+$/.test(para) ? para : undefined
}

export default async function NovaSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string; para?: string; dev?: string }>
}) {
  const { telefone, para, dev } = await searchParams
  if (!telefone) redirect('/entrar/esqueci')

  const destino = destinoValido(para)

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Nova palavra-passe</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        {destino ? (
          <>
            Mandamos um código para <span className="text-body">{destino}</span>. Ele vale por 5
            minutos.
          </>
        ) : (
          <>
            Se {formatPhone(telefone)} for de alguém da equipa, o código já está a caminho do e-mail
            registado. Não chegou nada? Fale com quem cuida do sistema.
          </>
        )}
      </p>

      {dev ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Modo desenvolvimento — código: <span className="font-mono font-semibold">{dev}</span>
        </p>
      ) : null}

      <div className="surface rounded-card p-5">
        <NovaSenhaForm telefone={telefone} />
      </div>

      <p className="text-muted mt-6 text-xs leading-relaxed">
        Trocar a palavra-passe desliga todos os aparelhos que estavam a usar a antiga.
      </p>
    </div>
  )
}
