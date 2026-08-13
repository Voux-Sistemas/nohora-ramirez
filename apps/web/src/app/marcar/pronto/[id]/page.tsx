import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Monogram } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { formatMoney, formatDateLong, formatPhone, formatTime } from '@/lib/format'
import { href } from '@/lib/utils'
import { getAppointment } from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Marcação confirmada' }

/**
 * O selo.
 *
 * Esta é a única tela do produto que não é uma tarefa: é um momento. Por isso é
 * a única inteira de tinta, e a única com animação autoral — a coroa da marca
 * desenha-se, as folhas abrem, o swash atravessa por último. Acontece uma vez,
 * no instante em que o horário fica marcado, e em lugar nenhum mais. Se isto
 * estivesse em todas as secções seria maneirismo; aqui é assinatura.
 *
 * Quem pediu para desligar movimento recebe o selo pronto, não a tela vazia
 * (ver `prefers-reduced-motion` em globals.css).
 */
export default async function ProntoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const marcacao = await getAppointment(id)
  if (!marcacao) notFound()

  const data = isoDateInZone(marcacao.start, marcacao.timezone)

  return (
    <main className="min-h-dvh bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      <div className="mx-auto w-full max-w-lg px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col items-center text-center">
          <Monogram
            drawn
            label="Nohora Ramirez Beauty Studio"
            className="w-36 text-[1.25rem] text-(--on-ink-accent) sm:w-40 sm:text-[1.375rem]"
          />

          <h1 className="display display-lg mt-8">
            Está marcado, {primeiroNome(marcacao.clientName)}.
          </h1>

          <p className="tnum mt-4 text-lg text-(--on-ink-muted) first-letter:uppercase">
            {formatDateLong(data)}
            <span className="mx-2 text-(--on-ink-accent)">·</span>
            <span className="text-(--on-ink)">{formatTime(marcacao.start, marcacao.timezone)}</span>
          </p>

          <p className="mt-1 text-sm text-(--on-ink-muted)">{marcacao.unitName}</p>
        </div>

        <div className="mt-12 border-t border-(--border-on-ink) pt-7">
          <ul className="space-y-4">
            {marcacao.items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3">
                <span className="tnum w-12 shrink-0 text-sm text-(--on-ink-muted)">
                  {formatTime(item.start, marcacao.timezone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.serviceName}</span>
                  <span className="text-sm text-(--on-ink-muted)">com {item.staffName}</span>
                </span>
                <span className="tnum shrink-0 text-sm">{formatMoney(item.price)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between border-t border-(--border-on-ink) pt-5">
            <span className="font-medium">Total</span>
            <span className="tnum display text-[1.75rem] leading-none">
              {formatMoney(marcacao.totalPrice)}
            </span>
          </div>

          {marcacao.depositRequired > 0 ? (
            <p className="mt-4 text-sm text-(--on-ink-muted)">
              Sinal de{' '}
              <span className="tnum font-medium text-(--on-ink)">
                {formatMoney(marcacao.depositRequired)}
              </span>{' '}
              — o link de pagamento chega no WhatsApp{' '}
              <span className="tnum">{formatPhone(marcacao.clientPhone)}</span>.
            </p>
          ) : (
            <p className="mt-4 text-sm text-(--on-ink-muted)">
              Nada a pagar agora. O acerto é no salão, no dia.
            </p>
          )}
        </div>

        {/*
          Contorno, não bloco cheio. Marcar outra coisa é o que o salão quer,
          não o que a cliente veio fazer — ela já terminou. Uma placa clara de
          620px sobre tinta rouba a tela do selo, que é o assunto.
        */}
        <div className="mt-10 flex flex-col gap-3">
          <Link
            href={href('/minha-conta')}
            className={buttonVariants({ variant: 'on-ink-outline', size: 'xl' })}
          >
            Ver as minhas marcações
          </Link>
          <Link
            href={href(`/marcar?casa=${marcacao.unitSlug}`)}
            className="text-center text-sm text-(--on-ink-muted) transition-colors hover:text-(--on-ink)"
          >
            Marcar outro serviço
          </Link>
        </div>
      </div>
    </main>
  )
}

function primeiroNome(nome: string): string {
  return nome.split(' ')[0] ?? nome
}
