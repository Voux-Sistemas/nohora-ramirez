import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PainelShell } from '@/components/shell/painel-shell'
import { Button } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatTime, simboloMoeda } from '@/lib/format'
import { href } from '@/lib/utils'
import { podeGerir, requireUnidade } from '@/server/auth/permissoes'
import { PAYMENT_METHOD_LABEL, getComanda } from '@/server/finance/comanda'
import { contextoDoPainel } from '@/server/painel/contexto'
import { fecharComanda } from './actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Comanda' }

/**
 * Comanda é caixa: recebe dinheiro, dá desconto e credita comissão. Tela de
 * gestão.
 *
 * ── Uma correcção de segurança que veio de graça ─────────────────────────
 * O endereço era `/agenda/[unidade]/comanda/[id]`, e a loja saía do caminho.
 * A permissão era verificada contra a unidade DO ENDEREÇO e depois comparada
 * com a da comanda — dois passos que tinham de concordar, e o segundo existia
 * só para tapar o primeiro. Agora a casa sai da própria comanda, que é a única
 * fonte que não se escreve na barra do navegador.
 */
export default async function ComandaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { acesso, unidades, unidade } = await contextoDoPainel()
  if (!podeGerir(acesso)) redirect('/painel/agenda')

  const comanda = await getComanda(id)
  if (!comanda) notFound()
  requireUnidade(acesso, comanda.unitId)

  /* A hora é a da casa onde o atendimento aconteceu, não a da casa activa na
     barra: a comanda de ontem no Valongo não muda de hora por a recepção estar
     agora a olhar para a Maia. */
  const casa = unidades.find((item) => item.id === comanda.unitId) ?? unidade!
  const moeda = simboloMoeda()

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="hoje"
      titulo="Comanda"
      descricao={comanda.clientName}
      semCasa
    >
      <div className="max-w-2xl">
      <Link href={href('/painel')} className="text-muted text-sm hover:underline">
        ← agenda
      </Link>

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
                  <span className="text-muted"> · {formatDateLong(isoDateInZone(p.paidAt, casa.timezone))} {formatTime(p.paidAt, casa.timezone)}</span>
                </span>
                <span className="tnum">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-3 text-sm">Comanda fechada — comissão gerada por item.</p>
        </section>
      ) : comanda.status !== 'completed' ? (
        <p className="surface rounded-card text-muted p-5 text-sm">
          Só é possível fechar a comanda depois que o atendimento estiver concluído.
        </p>
      ) : (
        <section className="surface rounded-card p-5">
          <h2 className="mb-3 font-medium">Fechar comanda</h2>
          <form action={fecharComanda} className="flex flex-col gap-4">
            <input type="hidden" name="appointmentId" value={comanda.appointmentId} />
            

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Desconto ({moeda})
                <input className="field" type="number" step="0.01" min="0" name="discountAmount" defaultValue="0" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Motivo do desconto
                <input className="field" name="discountReason" placeholder="opcional" />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Pagamento (pode dividir em até 3 formas)</p>
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <select className="field" name={`p${i}_method`} defaultValue={i === 1 ? 'pix' : ''}>
                      <option value="">—</option>
                      <option value="cash">Dinheiro</option>
                      <option value="debit_card">Débito</option>
                      <option value="credit_card">Crédito</option>
                      <option value="pix">Pix</option>
                      <option value="other">Outro</option>
                    </select>
                    <input
                      className="field"
                      type="number"
                      step="0.01"
                      min="0"
                      name={`p${i}_amount`}
                      placeholder={`${moeda} 0,00`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-muted mt-2 text-xs">
                A soma dos pagamentos precisa bater exatamente com o total menos o desconto. Pagamento em
                dinheiro exige caixa aberto na unidade.
              </p>
            </div>

            <div>
              <Button type="submit">Fechar comanda</Button>
            </div>
          </form>
        </section>
      )}
      </div>
    </PainelShell>
  )
}
