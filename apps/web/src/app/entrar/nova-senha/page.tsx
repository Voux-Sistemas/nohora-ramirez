import { redirect } from 'next/navigation'
import { CodigoDeTeste, Porta } from '@/components/auth/porta'
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
    <Porta
      title="Nova palavra-passe"
      subtitle={
        destino ? (
          <>
            Mandamos um código para <span className="text-(--text-strong)">{destino}</span>. Ele
            vale por 5 minutos.
          </>
        ) : (
          <>
            Se {formatPhone(telefone)} for de alguém da equipa, o código já está a caminho do e-mail
            registado. Não chegou nada? Fale com quem cuida do sistema.
          </>
        )
      }
      footer="Trocar a palavra-passe desliga todos os aparelhos que estavam a usar a antiga."
    >
      <CodigoDeTeste codigo={dev} />
      <div className="surface rounded-card p-5">
        <NovaSenhaForm telefone={telefone} />
      </div>
    </Porta>
  )
}
