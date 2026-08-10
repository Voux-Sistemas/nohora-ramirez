'use client'

/**
 * Mantém a tela em dia sem ninguém apertar F5.
 *
 * ── O problema ────────────────────────────────────────────────────────────
 * A agenda do dia é a única tela que duas pessoas olham ao mesmo tempo: a
 * recepção marca no balcão e a profissional está com a prancheta aberta na
 * cadeira. Sem isto, a prancheta dela congela no estado de quando abriu — e ela
 * descobre a cliente nova quando a cliente chega.
 *
 * ── Por que não é WebSocket ───────────────────────────────────────────────
 * Um salão tem uma dúzia de telas abertas, não dez mil. Recarregar o servidor a
 * cada 45 segundos são duas consultas — menos custo do que manter uma conexão
 * viva por aba, e nada para dar errado quando o Railway troca o processo. O
 * ganho de WebSocket aqui seria diferença entre "na hora" e "em menos de um
 * minuto", num lugar onde ninguém cronometra.
 *
 * ── O que ele não faz ─────────────────────────────────────────────────────
 * Não roda com a aba escondida. O celular da profissional fica no bolso o dia
 * inteiro: manter tique lá é gastar bateria dela para nada. Ao voltar para a
 * aba, atualiza na hora se o que está na tela já envelheceu.
 */

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

const INTERVALO_PADRAO_MS = 45_000

export function AtualizaSozinho({
  ativo = true,
  intervaloMs = INTERVALO_PADRAO_MS,
}: {
  /** Desligue em telas que não mudam sozinhas — um dia que já passou, por exemplo. */
  ativo?: boolean
  intervaloMs?: number
}) {
  const router = useRouter()
  const ultima = useRef(Date.now())

  useEffect(() => {
    if (!ativo) return

    let tique: ReturnType<typeof setInterval> | undefined

    const atualizar = () => {
      ultima.current = Date.now()
      router.refresh()
    }

    const ligar = () => {
      if (tique) return
      tique = setInterval(() => {
        if (!document.hidden) atualizar()
      }, intervaloMs)
    }

    const desligar = () => {
      if (tique) clearInterval(tique)
      tique = undefined
    }

    const aoMudarDeFoco = () => {
      if (document.hidden) {
        desligar()
        return
      }
      ligar()
      if (Date.now() - ultima.current > intervaloMs) atualizar()
    }

    ligar()
    document.addEventListener('visibilitychange', aoMudarDeFoco)
    window.addEventListener('focus', aoMudarDeFoco)

    return () => {
      desligar()
      document.removeEventListener('visibilitychange', aoMudarDeFoco)
      window.removeEventListener('focus', aoMudarDeFoco)
    }
  }, [ativo, intervaloMs, router])

  return null
}
