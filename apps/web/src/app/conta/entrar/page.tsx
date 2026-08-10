import { PhoneForm } from '@/components/auth/phone-form'
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
      <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
        <h1 className="text-2xl font-semibold">Minha conta</h1>
        <p className="text-muted mt-1 mb-6 text-sm">
          A área da cliente ainda está em preparo.
        </p>
        <div className="surface rounded-card p-5">
          <p className="text-sm leading-relaxed">
            Para ver, remarcar ou cancelar um horário, fale direto com o salão — a recepção
            resolve na hora.
          </p>
          <p className="text-muted mt-4 text-sm leading-relaxed">
            Para marcar um novo horário você não precisa de conta:{' '}
            <a className="underline underline-offset-4" href="/agendar">
              agende por aqui
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Minha conta</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        Digite seu telefone e mandamos um código para o seu e-mail.
      </p>
      <div className="surface rounded-card p-5">
        <PhoneForm />
      </div>
    </div>
  )
}
