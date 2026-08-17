import Link from 'next/link'
import { Porta } from '@/components/auth/porta'
import { PedirCodigoForm } from '@/components/auth/recuperacao-forms'
import { recuperacaoDisponivel } from '@/server/auth/recuperacao'

export const metadata = { title: 'Esqueci-me da palavra-passe' }

/* A decisão depende de variável de ambiente: tem que ser por requisição, senão
   preencher a variável no Railway não muda nada até o próximo deploy. */
export const dynamic = 'force-dynamic'

export default function EsqueciPage() {
  if (!recuperacaoDisponivel()) {
    return (
      <Porta
        title="Esqueci-me da palavra-passe"
        subtitle="A troca pela internet ainda não está ligada."
        footer={<VoltarAoLogin />}
      >
        <div className="surface rounded-card p-5">
          <p className="text-sm leading-relaxed">
            Fale com quem cuida do sistema: a palavra-passe é redefinida na hora, e escolhe uma nova
            no primeiro acesso.
          </p>
        </div>
      </Porta>
    )
  }

  return (
    <Porta
      title="Esqueci-me da palavra-passe"
      subtitle="Escreva o seu telefone. Enviamos um código para o e-mail registado na sua conta."
      footer={<VoltarAoLogin />}
    >
      <div className="surface rounded-card p-5">
        <PedirCodigoForm />
      </div>
    </Porta>
  )
}

function VoltarAoLogin() {
  return (
    <Link className="underline underline-offset-4 hover:text-(--text-strong)" href="/entrar">
      Voltar para o login
    </Link>
  )
}
