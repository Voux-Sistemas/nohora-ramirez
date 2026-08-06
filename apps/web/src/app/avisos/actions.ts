'use server'

/**
 * Registrar o envio é o que tira a pessoa da fila — não existe outro estado.
 *
 * Como quem entrega a mensagem é o WhatsApp da recepção, e não a nossa
 * aplicação, o sistema não tem como saber se ela realmente apertou "enviar" lá
 * dentro. A escolha aqui é registrar no clique e oferecer o desfazer: errar
 * para o lado de "já avisei" evita mandar a mesma mensagem duas vezes para a
 * cliente, que é o erro que ela percebe. O outro lado — deixar de avisar — a
 * recepção corrige com um clique em "desfazer".
 */

import { notificationLogs } from '@studio/db'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { requireStaffSession } from '@/server/auth/session'
import type { RoutineKey } from '@/server/notifications/templates'

/*
 * Nenhuma das duas ações revalida a rota de propósito.
 *
 * A lista precisa ficar parada enquanto a recepção desce por ela: se cada
 * clique reordenasse a tela, o próximo alvo mudaria de lugar embaixo do dedo —
 * e é exatamente isso que faz alguém pular uma pessoa. Quem manda no que
 * aparece é o estado local da fila; o servidor volta a ser a verdade na próxima
 * navegação, quando a lista já não está sendo trabalhada.
 */
export async function marcarComoAvisado(
  appointmentId: string,
  routine: RoutineKey,
  destino: string,
): Promise<void> {
  await requireStaffSession()

  await db.insert(notificationLogs).values({
    channel: 'whatsapp',
    templateKey: routine,
    refType: 'appointment',
    refId: appointmentId,
    destination: destino,
    status: 'sent',
    sentAt: new Date(),
    // Sem custo por mensagem: quem entrega é o WhatsApp do próprio salão.
    costCents: 0,
    payload: { via: 'click-to-whatsapp' },
  })
}

/** Devolve a pessoa para a fila. Existe porque o clique não prova entrega. */
export async function desfazerAviso(
  appointmentId: string,
  routine: RoutineKey,
): Promise<void> {
  await requireStaffSession()

  await db
    .delete(notificationLogs)
    .where(
      and(
        eq(notificationLogs.refType, 'appointment'),
        eq(notificationLogs.refId, appointmentId),
        eq(notificationLogs.templateKey, routine),
      ),
    )
}
