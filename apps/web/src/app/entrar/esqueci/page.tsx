import Link from 'next/link'
import { PedirCodigoForm } from '@/components/auth/recuperacao-forms'
import { recuperacaoDisponivel } from '@/server/auth/recuperacao'

export const metadata = { title: 'Esqueci a senha' }

/* A decisão depende de variável de ambiente: tem que ser por requisição, senão
   preencher a variável no Railway não muda nada até o próximo deploy. */
export const dynamic = 'force-dynamic'

export default function EsqueciPage() {
  if (!recuperacaoDisponivel()) {
    return (
      <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
        <h1 className="text-2xl font-semibold">Esqueci a senha</h1>
        <p className="text-muted mt-1 mb-6 text-sm">A troca pela internet ainda não está ligada.</p>
        <div className="surface rounded-card p-5">
          <p className="text-sm leading-relaxed">
            Fale com quem cuida do sistema: a senha é redefinida na hora, e você escolhe uma nova
            no primeiro acesso.
          </p>
        </div>
        <Link className="text-muted mt-6 text-sm underline underline-offset-4" href="/entrar">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Esqueci a senha</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        Digite seu telefone. Mandamos um código para o e-mail cadastrado na sua conta.
      </p>
      <div className="surface rounded-card p-5">
        <PedirCodigoForm />
      </div>
      <Link className="text-muted mt-6 text-sm underline underline-offset-4" href="/entrar">
        Voltar para o login
      </Link>
    </div>
  )
}
