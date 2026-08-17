import Link from 'next/link'
import { PhoneForm } from '@/components/auth/phone-form'
import { Porta } from '@/components/auth/porta'
import { loginClienteDisponivel } from '@/server/auth/otp'

export const metadata = { title: 'Entrar' }

/*
  Sem isto o Next resolve a checagem no build e congela o resultado na página
  estática. Preencher as variáveis no Railway não teria efeito até o próximo
  deploy — e um deploy que herdasse a variável errada publicaria o formulário
  sem ninguém perceber. A decisão tem que ser por requisição.
*/
export const dynamic = 'force-dynamic'

export default function ContaEntrarPage() {
  /*
    Sem canal de envio, o formulário só levaria a uma espera por mensagem que
    nunca chega. Melhor dizer a verdade e apontar o caminho que funciona hoje.
  */
  if (!loginClienteDisponivel()) {
    return (
      <Porta title="A minha conta" subtitle="A área da cliente ainda está em preparação.">
        <div className="surface rounded-card p-5">
          <p className="text-sm leading-relaxed">
            Para ver, remarcar ou cancelar um horário, fale diretamente com o salão — a receção
            resolve na hora.
          </p>
          <p className="text-muted mt-4 text-sm leading-relaxed">
            Para marcar um novo horário não precisa de conta:{' '}
            <Link className="underline underline-offset-4" href="/agendar">
              agende por aqui
            </Link>
            .
          </p>
        </div>
      </Porta>
    )
  }

  return (
    <Porta
      title="A minha conta"
      subtitle="Escreva o seu telefone e enviamos um código para o seu e-mail."
      footer={
        <>
          Ainda não é nossa cliente?{' '}
          <Link className="underline underline-offset-4 hover:text-(--text-strong)" href="/agendar">
            Marque o primeiro horário
          </Link>
          .
        </>
      }
    >
      <div className="surface rounded-card p-5">
        <PhoneForm />
      </div>
    </Porta>
  )
}
