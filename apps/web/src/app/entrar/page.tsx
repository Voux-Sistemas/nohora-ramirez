import Link from 'next/link'
import { PhoneForm } from '@/components/auth/phone-form'
import { ehTeste } from '@/lib/ambiente'
import { href } from '@/lib/utils'
import { loginClienteDisponivel } from '@/server/auth/otp'

/*
  Sem isto o Next resolve a verificação no build e congela o resultado na
  página estática. Preencher as variáveis no Railway não teria efeito até ao
  próximo deploy — e um deploy que herdasse a variável errada publicaria o
  formulário sem ninguém perceber. A decisão tem de ser por requisição.
*/
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Entrar' }

/**
 * A entrada da cliente.
 *
 * É a porta principal: quem escreve o endereço do salão e clica em "Entrar" é,
 * quase sempre, uma cliente. A equipa tem a porta ao lado, escrita em letra
 * pequena — são oito pessoas e elas sabem onde é.
 */
export default function EntrarPage() {
  /*
    Sem canal de envio, o formulário só levaria a uma espera por uma mensagem
    que nunca chega. Melhor dizer a verdade e apontar o caminho que funciona.
  */
  if (!loginClienteDisponivel()) {
    return (
      <>
        <h1 className="display display-md">A conta ainda está a preparar-se</h1>
        <div className="rule-bronze mt-4 w-12" />
        <p className="text-body mt-5 text-[0.9375rem] leading-relaxed">
          Para ver, remarcar ou cancelar um horário, fale directamente com o salão — a recepção
          resolve na hora.
        </p>
        <PortaDaEquipa />
      </>
    )
  }

  return (
    <>
      <h1 className="display display-md">A minha conta</h1>
      <div className="rule-bronze mt-4 w-12" />
      <p className="text-body mt-5 mb-7 text-[0.9375rem] leading-relaxed">
        Escreva o seu telemóvel e enviamos-lhe um código. É assim que vê, remarca ou cancela o que
        já está marcado.
      </p>

      <PhoneForm demo={ehTeste()} />

      <PortaDaEquipa />
    </>
  )
}

function PortaDaEquipa() {
  return (
    <p className="text-muted mt-8 border-t border-(--border-subtle) pt-6 text-[0.8125rem]">
      Trabalha no salão?{' '}
      <Link
        href={href('/entrar/equipa')}
        className="text-(--text-strong) underline underline-offset-4"
      >
        Entre pela área da equipa
      </Link>
      .
    </p>
  )
}
