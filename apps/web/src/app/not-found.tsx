import Link from 'next/link'
import { Recado } from '@/components/ui/recado'
import { buttonVariants } from '@/components/ui/button'

export const metadata = { title: 'Página não encontrada' }

/**
 * 404 — e também a resposta de "isso não é seu".
 *
 * Boa parte dos `notFound()` do sistema não é endereço errado: é o gerente do
 * Centro tentando abrir o caixa do Jardins. Por isso o texto não afirma que a
 * página não existe — ele diz que ela não está aqui *para quem está lendo*.
 * Dizer "sem permissão" confirmaria a existência da loja; dizer "não existe"
 * seria mentira para quem digitou o endereço certo da loja errada.
 */
export default function NotFound() {
  return (
    <Recado
      titulo="Esta página não está aqui"
      acoes={
        <Link href="/" className={buttonVariants({ variant: 'outline' })}>
          Voltar ao início
        </Link>
      }
    >
      <p>
        Ou o endereço mudou, ou ele pertence a uma unidade que não é a sua. Se esperava
        encontrar algo aqui, fale com a administração.
      </p>
    </Recado>
  )
}
