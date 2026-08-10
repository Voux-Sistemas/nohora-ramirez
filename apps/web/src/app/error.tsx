'use client'

import { useEffect } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Recado } from '@/components/ui/recado'

/**
 * O que a recepção vê quando algo estoura no servidor.
 *
 * Sem este arquivo o Next mostra a própria tela de erro — em produção, um
 * retângulo cinza com "Application error: a client-side exception has occurred".
 * Numa segunda-feira de salão cheio isso não diz nem o que fazer nem a quem
 * recorrer, e a recepção conclui que o sistema morreu quando o que caiu foi
 * uma consulta.
 *
 * Duas decisões:
 *
 * 1. **`reset()` primeiro.** A maioria dos erros de servidor aqui é
 *    intermitente — banco reiniciando no deploy, conexão que caiu. Tentar de
 *    novo resolve sem perder a tela em que a pessoa estava, e é o que um
 *    humano faria antes de chamar alguém.
 * 2. **O `digest` aparece.** É o único fio entre "deu erro no caixa às 14h20"
 *    e a linha no log do Railway. Sem ele, investigar é adivinhar.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    /* O servidor já registrou o stack; do lado do cliente sobra o digest, e é
       ele que amarra os dois lados quando alguém for procurar. */
    // eslint-disable-next-line no-console
    console.error('[erro]', error.digest ?? '(sem digest)', error.message)
  }, [error])

  return (
    <Recado
      titulo="Alguma coisa falhou aqui"
      nota={error.digest ? `código do erro: ${error.digest}` : undefined}
      acoes={
        <>
          <Button onClick={reset}>Tentar de novo</Button>
          <a href="/" className={buttonVariants({ variant: 'ghost' })}>
            Voltar ao início
          </a>
        </>
      }
    >
      <p>
        Não foi culpa sua e nada do que você já tinha salvo se perdeu. Quase sempre é passageiro:
        tente de novo.
      </p>
      <p className="text-muted mt-3">
        Se insistir, siga o atendimento pelo caderno e avise a administração — o horário e o código
        abaixo bastam para achar o que houve.
      </p>
    </Recado>
  )
}
