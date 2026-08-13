import Link from 'next/link'
import { PedirCodigoForm } from '@/components/auth/recuperacao-forms'
import { href } from '@/lib/utils'
import { recuperacaoDisponivel } from '@/server/auth/recuperacao'

export const metadata = { title: 'Esqueci-me da senha' }

/* A decisão depende de variável de ambiente: tem de ser por requisição, senão
   preencher a variável no Railway não muda nada até ao próximo deploy. */
export const dynamic = 'force-dynamic'

export default function EsqueciPage() {
  if (!recuperacaoDisponivel()) {
    return (
      <>
        <h1 className="display display-md">Esqueci-me da senha</h1>
        <div className="rule-bronze mt-4 w-12" />
        <p className="text-body mt-5 text-[0.9375rem] leading-relaxed">
          A troca pela internet ainda não está ligada. Fale com quem cuida do sistema: a senha é
          redefinida na hora e escolhe uma nova no primeiro acesso.
        </p>
        <Voltar />
      </>
    )
  }

  return (
    <>
      <h1 className="display display-md">Esqueci-me da senha</h1>
      <div className="rule-bronze mt-4 w-12" />
      <p className="text-body mt-5 mb-7 text-[0.9375rem] leading-relaxed">
        Escreva o seu telemóvel. Enviamos um código para o e-mail que está no seu cadastro.
      </p>
      <PedirCodigoForm />
      <Voltar />
    </>
  )
}

function Voltar() {
  return (
    <p className="text-muted mt-8 border-t border-(--border-subtle) pt-6 text-[0.8125rem]">
      <Link
        href={href('/entrar/equipa')}
        className="text-(--text-strong) underline underline-offset-4"
      >
        Voltar à entrada da equipa
      </Link>
    </p>
  )
}
