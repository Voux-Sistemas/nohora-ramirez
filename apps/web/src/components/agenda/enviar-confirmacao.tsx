'use client'

import { useState, useTransition } from 'react'
import { desfazerConfirmacao, enviarConfirmacao } from '@/server/scheduling/actions'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * O dever de confirmar, na ficha de quem atende.
 *
 * A recepção tem a fila de `/avisos` para descer de uma assentada; a
 * profissional não tem fila nenhuma — tem a agenda dela, e é ali que este gesto
 * tinha de aparecer. É o mesmo registo dos dois lados (`notification_logs`,
 * rotina `confirmacao`), portanto quem confirmar aqui tira a cliente da fila
 * da recepção, e vice-versa.
 *
 * `<a target="_blank">` de verdade, como em `notice-queue.tsx`: o navegador só
 * deixa abrir aba dentro do gesto directo de quem carrega, e um `window.open`
 * depois de um `await` é barrado como pop-up.
 *
 * O rótulo diz "Enviar confirmação" e nunca "Confirmar", porque "Confirmar" já
 * é outro botão a dois centímetros deste — o que passa a marcação de `scheduled`
 * a `confirmed`. São dois factos diferentes: um diz que a casa escreveu à
 * cliente, o outro diz que a cliente respondeu que vem. Este botão não mexe no
 * estado da marcação de propósito; dar por confirmada quem ainda nem abriu a
 * mensagem é como se enche uma cadeira vazia.
 */
export function EnviarConfirmacao({
  appointmentId,
  link,
  enviadaEm,
}: {
  appointmentId: string
  /** `wa.me` com a mensagem já escrita, na língua da cliente. */
  link: string
  /** Quando já foi enviada, o dia e a hora prontos para ler. */
  enviadaEm: string | null
}) {
  /* `null` é "o que o servidor diz"; um booleano é a escolha que ainda não
     voltou de lá. Sem os três estados, desfazer logo a seguir a enviar ficava
     preso ao valor que veio na página. */
  const [otimista, setOtimista] = useState<boolean | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [, startTransition] = useTransition()

  const feito = otimista ?? enviadaEm !== null

  function enviar() {
    setOtimista(true)
    setFalhou(false)
    startTransition(async () => {
      try {
        await enviarConfirmacao(appointmentId)
      } catch {
        setOtimista(false)
        setFalhou(true)
      }
    })
  }

  function desfazer() {
    setOtimista(false)
    setFalhou(false)
    startTransition(async () => {
      try {
        await desfazerConfirmacao(appointmentId)
      } catch {
        setOtimista(true)
        setFalhou(true)
      }
    })
  }

  return (
    <div>
      {feito ? (
        <p className="text-muted flex flex-wrap items-center gap-2 text-sm">
          <span>
            Confirmação enviada
            {/* Sem data quando a marca ainda é otimista: a hora certa vem com a
                página revalidada, e inventar uma aqui era escrever o relógio
                deste browser num registo que é do servidor. */}
            {enviadaEm && otimista !== true ? <> · {enviadaEm}</> : null}
          </span>
          <button
            type="button"
            onClick={desfazer}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            desfazer
          </button>
        </p>
      ) : (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={enviar}
          className={cn(buttonVariants({ variant: 'outline' }))}
        >
          Enviar confirmação
        </a>
      )}

      {falhou ? (
        <p className="mt-2 text-sm text-(--estado-mau)" role="alert">
          {feito
            ? 'Não deu para tirar a marca — no sistema esta confirmação continua enviada.'
            : 'O envio não ficou registado. Volte a carregar em Enviar confirmação.'}
        </p>
      ) : null}
    </div>
  )
}
