'use client'

import { useState, useTransition } from 'react'
import { desfazerAviso, marcarComoAvisado } from '@/app/painel/avisos/actions'
import { buttonVariants } from '@/components/ui/button'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Notice } from '@/server/notifications/queue'
import type { RoutineKey } from '@/server/notifications/templates'

/**
 * A fila que a recepção desce.
 *
 * O gesto inteiro é um só: clicar em "Avisar" abre o WhatsApp com a mensagem
 * já escrita e, no mesmo clique, registra o envio. A linha não some — vira
 * "avisada" com um desfazer do lado. Sumir seria mais limpo de olhar e pior de
 * usar: a lista se reorganizaria embaixo do dedo de quem está descendo por ela,
 * e é assim que se pula uma pessoa sem perceber.
 *
 * O link é um `<a target="_blank">` de verdade, e não um `onClick` que abre
 * janela por código, porque o navegador só deixa abrir aba dentro do gesto
 * direto do usuário — um `window.open` depois de um `await` é bloqueado como
 * pop-up.
 */
export function NoticeQueue({
  routine,
  notices,
  timezone,
}: {
  routine: RoutineKey
  notices: readonly Notice[]
  /** Fuso da unidade: o horário mostrado é o da loja, não o do navegador. */
  timezone: string
}) {
  const [avisados, setAvisados] = useState<ReadonlySet<string>>(new Set())
  const [, startTransition] = useTransition()

  function marcar(notice: Notice) {
    setAvisados((atual) => new Set(atual).add(notice.appointmentId))
    startTransition(() => {
      void marcarComoAvisado(notice.appointmentId, routine, notice.clientPhone)
    })
  }

  function desfazer(notice: Notice) {
    setAvisados((atual) => {
      const proximo = new Set(atual)
      proximo.delete(notice.appointmentId)
      return proximo
    })
    startTransition(() => {
      void desfazerAviso(notice.appointmentId, routine)
    })
  }

  if (notices.length === 0) {
    return (
      <p className="surface rounded-card text-muted p-6 text-sm">
        Ninguém para avisar nesta lista.
      </p>
    )
  }

  const restam = notices.length - avisados.size

  return (
    <>
      <ul className="surface rounded-card divide-y divide-(--border-subtle)">
        {notices.map((notice) => {
          const feito = avisados.has(notice.appointmentId)
          const semTelefone = notice.clientPhone.replace(/\D/g, '').length < 10

          return (
            <li
              key={notice.appointmentId}
              className={cn('px-4 py-3.5 transition-opacity', feito && 'opacity-45')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{notice.clientName}</p>
                  <p className="text-muted mt-0.5 text-sm">
                    <span className="tnum">{formatTime(notice.start, timezone)}</span>
                    {' · '}
                    {notice.services}
                    {' · '}
                    {notice.staffName}
                  </p>
                </div>

                {feito ? (
                  <button
                    type="button"
                    onClick={() => desfazer(notice)}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'shrink-0')}
                  >
                    desfazer
                  </button>
                ) : semTelefone ? (
                  <span className="text-muted shrink-0 self-center text-xs">sem telefone</span>
                ) : (
                  <a
                    href={notice.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => marcar(notice)}
                    className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}
                  >
                    Avisar
                  </a>
                )}
              </div>

              {/*
                O texto fica fechado. Na primeira semana a recepção abre para
                conferir; depois confia e só clica — e aí um bloco de mensagem
                por linha seria uma tela de rolagem para nada.
              */}
              <details className="group mt-2">
                <summary className="text-muted hover:text-(--text-strong) cursor-pointer text-xs transition-colors">
                  ver mensagem
                </summary>
                <p className="text-body mt-2 rounded-lg bg-(--surface-sunken) p-3 text-sm whitespace-pre-line">
                  {notice.message}
                </p>
              </details>
            </li>
          )
        })}
      </ul>

      <p className="text-muted mt-3 text-sm">
        {restam === 0 ? (
          'Lista concluída.'
        ) : (
          <>
            <span className="tnum">{restam}</span> {restam === 1 ? 'restante' : 'restantes'}
          </>
        )}
      </p>
    </>
  )
}
