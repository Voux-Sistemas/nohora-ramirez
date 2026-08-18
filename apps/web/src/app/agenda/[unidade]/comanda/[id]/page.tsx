import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ComandaForm } from '@/components/agenda/comanda-form'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { href } from '@/lib/utils'
import { requireGestao, requireUnidade } from '@/server/auth/permissoes'
import { PAYMENT_METHOD_LABEL, getComanda, metodosDoPais } from '@/server/finance/comanda'
import { getUnitBySlug } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * Comanda é caixa: recebe dinheiro e dá desconto. Tela de
 * gestão, e presa à unidade do atendimento — o slug do endereço é só o caminho
 * de volta para a agenda, não a fonte da permissão.
 */
export default async function ComandaPage({
  params,
}: {
  params: Promise<{ unidade: string; id: string }>
}) {
  const { unidade, id } = await params
  const acesso = await requireGestao()
  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()

  const comanda = await getComanda(id)
  if (!comanda || comanda.unitId !== unit.id) notFound()
  requireUnidade(acesso, comanda.unitId)
  /* O rótulo é resolvido aqui porque `PAYMENT_METHOD_LABEL` vive no módulo
     `server-only` do fecho — atravessa para o formulário já como texto. */
  const metodos = metodosDoPais().map((valor) => ({
    valor,
    rotulo: PAYMENT_METHOD_LABEL[valor],
  }))

  /* Com o dia do atendimento, e não sem ele: a agenda abre em `hoje` quando
     não lhe dizem outra coisa, e voltar de uma comanda de sábado aterrava na
     segunda-feira, com a recepção a procurar o dia outra vez à mão. */
  const diaDoAtendimento = isoDateInZone(comanda.startsAt, unit.timezone)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={href(`/agenda/${unit.slug}?d=${diaDoAtendimento}`)}
        className="text-muted text-sm hover:underline"
      >
        ← agenda
      </Link>

      <header className="mt-4 mb-6">
        <h1 className="text-2xl font-semibold">Comanda</h1>
        <p className="text-muted mt-1 text-sm">{comanda.clientName}</p>
      </header>

      <section className="surface rounded-card mb-6 p-5">
        <h2 className="mb-3 font-medium">Itens</h2>
        <ul className="divide-y divide-(--border-subtle) text-sm">
          {comanda.items.map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 py-2">
              <span>
                {item.serviceName}
                <span className="text-muted"> · {item.staffName}</span>
              </span>
              <span className="tnum">{formatMoney(item.price)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-baseline justify-between border-t border-(--border-subtle) pt-3 text-sm">
          <span>Subtotal</span>
          <span className="tnum">{formatMoney(comanda.subtotal)}</span>
        </p>
        {comanda.discount > 0 ? (
          <p className="text-muted flex items-baseline justify-between text-sm">
            <span>Desconto{comanda.discountReason ? ` (${comanda.discountReason})` : ''}</span>
            <span className="tnum">− {formatMoney(comanda.discount)}</span>
          </p>
        ) : null}
        <p className="mt-1 flex items-baseline justify-between font-medium">
          <span>Total</span>
          <span className="tnum">{formatMoney(comanda.total)}</span>
        </p>
      </section>

      {comanda.closed ? (
        <section className="surface rounded-card p-5">
          <h2 className="mb-3 font-medium">Pagamento</h2>
          <ul className="divide-y divide-(--border-subtle) text-sm">
            {comanda.payments.map((p) => (
              <li key={p.id} className="flex items-baseline justify-between gap-3 py-2">
                <span>
                  {PAYMENT_METHOD_LABEL[p.method]}
                  <span className="text-muted"> · {formatDateLong(isoDateInZone(p.paidAt, unit.timezone))} {formatTime(p.paidAt, unit.timezone)}</span>
                </span>
                <span className="tnum">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-3 text-sm">Comanda fechada — não aceita novos lançamentos.</p>
        </section>
      ) : comanda.status !== 'completed' ? (
        <p className="surface rounded-card text-muted p-5 text-sm">
          Só é possível fechar a comanda depois de o atendimento estar concluído.
        </p>
      ) : (
        <section className="surface rounded-card p-5">
          <h2 className="mb-3 font-medium">Fechar comanda</h2>
          <ComandaForm
            appointmentId={comanda.appointmentId}
            unitSlug={unit.slug}
            total={comanda.grossTotal}
            metodos={metodos}
          />
        </section>
      )}
    </div>
  )
}
