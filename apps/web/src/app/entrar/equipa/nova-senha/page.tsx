import { redirect } from 'next/navigation'
import { NovaSenhaForm } from '@/components/auth/recuperacao-forms'
import { formatPhone } from '@/lib/format'

export const metadata = { title: 'Nova senha' }

/*
  `para` vem do endereço, e endereço qualquer um escreve. Só passa o que tem a
  cara do mascaramento que nós próprios geramos — assim ninguém monta um link a
  dizer que o código foi para a caixa de outra pessoa.
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
  if (!telefone) redirect('/entrar/equipa/esqueci')

  const destino = destinoValido(para)

  return (
    <>
      <h1 className="display display-md">Nova senha</h1>
      <div className="rule-bronze mt-4 w-12" />
      <p className="text-body mt-5 mb-7 text-[0.9375rem] leading-relaxed">
        {destino ? (
          <>
            Enviámos um código para <span className="text-(--text-strong)">{destino}</span>. Vale
            por cinco minutos.
          </>
        ) : (
          <>
            Se <span className="tnum">{formatPhone(telefone)}</span> for de alguém da equipa, o
            código já vai a caminho do e-mail cadastrado. Não chegou nada? Fale com quem cuida do
            sistema.
          </>
        )}
      </p>

      {dev ? (
        <p className="rounded-plate mb-5 border border-(--accent)/40 bg-(--accent-wash) px-4 py-3 text-sm text-(--accent-ink)">
          Ambiente de teste — o código é{' '}
          <span className="tnum font-semibold tracking-[0.16em]">{dev}</span>
        </p>
      ) : null}

      <NovaSenhaForm telefone={telefone} />

      <p className="text-muted mt-6 text-xs leading-relaxed">
        Trocar a senha desliga todos os aparelhos que estavam a usar a antiga.
      </p>
    </>
  )
}
