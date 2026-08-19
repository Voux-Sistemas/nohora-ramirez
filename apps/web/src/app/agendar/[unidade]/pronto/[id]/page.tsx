import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Monogram } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { dicionario, interpola, localeDe, pedacos } from '@/i18n'
import { formatMoney, formatDateLongEm, formatPhone, formatTime } from '@/lib/format'
import { lerIdioma } from '@/lib/idioma'
import { loginClienteDisponivel } from '@/server/auth/otp'
import { getAppointment } from '@/server/scheduling/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  return { title: dicionario(await lerIdioma()).meta.marcacaoConfirmada }
}

/**
 * O selo.
 *
 * Esta é a única tela do produto que não é uma tarefa: é um momento. Por isso é
 * a única inteira de tinta, e a única com animação autoral — a coroa da marca se
 * desenha, as folhas abrem, o swash atravessa por último. Acontece uma vez, no
 * instante em que o horário fica marcado, e em lugar nenhum mais. Se isso
 * estivesse em toda seção seria maneirismo; aqui é assinatura.
 *
 * Quem pediu para desligar movimento recebe o selo pronto, não a tela vazia
 * (ver `prefers-reduced-motion` em globals.css).
 */
export default async function ProntoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ para?: string | string[] }>
}) {
  const { id } = await params
  const [appointment, idioma] = await Promise.all([getAppointment(id), lerIdioma()])
  if (!appointment) notFound()

  const dic = dicionario(idioma)
  const t = dic.agendar.pronto
  const date = isoDateInZone(appointment.start, appointment.timezone)
  const { para } = await searchParams
  const nome = primeiroNome(para)

  return (
    <main className="min-h-dvh bg-(--surface-ink) text-(--on-ink)">
      <div className="mx-auto w-full max-w-lg px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-col items-center text-center">
          <Monogram
            drawn
            label="Nohora Ramirez Beauty Studio"
            className="w-36 text-[1.25rem] text-(--on-ink-accent) sm:w-40 sm:text-[1.375rem]"
          />

          <h1 className="display display-lg mt-8">
            {nome ? interpola(t.tituloComNome, { nome }) : t.titulo}
          </h1>

          <p className="tnum mt-4 text-lg text-(--on-ink-muted)">
            {formatDateLongEm(date, localeDe(idioma))}
            <span className="mx-2 text-(--on-ink-accent)">·</span>
            <span className="text-(--on-ink)">
              {formatTime(appointment.start, appointment.timezone)}
            </span>
          </p>

          <p className="mt-1 text-sm text-(--on-ink-muted)">{appointment.unitName}</p>
        </div>

        <div className="mt-12 border-t border-(--border-on-ink) pt-7">
          <ul className="space-y-4">
            {appointment.items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-3">
                <span className="tnum w-12 shrink-0 text-sm text-(--on-ink-muted)">
                  {formatTime(item.start, appointment.timezone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.serviceName}</span>
                  <span className="text-sm text-(--on-ink-muted)">
                    {dic.comum.com} {item.staffName}
                  </span>
                </span>
                <span className="tnum shrink-0 text-sm">{formatMoney(item.price)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-baseline justify-between border-t border-(--border-on-ink) pt-5">
            <span className="font-medium">{dic.comum.total}</span>
            <span className="tnum display text-[1.75rem] leading-none">
              {formatMoney(appointment.totalPrice)}
            </span>
          </div>

          {appointment.depositRequired > 0 ? (
            /* Partida em pedaços, e não interpolada: o valor e o número levam
               peso próprio no meio da frase, e a ordem das palavras à volta
               deles muda de língua para língua. */
            <p className="mt-4 text-sm text-(--on-ink-muted)">
              {pedacos(t.sinal).map((pedaco, i) => {
                if (!('buraco' in pedaco)) return <span key={i}>{pedaco.texto}</span>
                return pedaco.buraco === 'valor' ? (
                  <span key={i} className="tnum font-medium text-(--on-ink)">
                    {formatMoney(appointment.depositRequired)}
                  </span>
                ) : (
                  <span key={i} className="tnum">
                    {formatPhone(appointment.clientPhone)}
                  </span>
                )
              })}
            </p>
          ) : (
            <p className="mt-4 text-sm text-(--on-ink-muted)">{t.semSinal}</p>
          )}
        </div>

        {/*
          Contorno, não bloco cheio. "Marcar outro serviço" é o que o salão
          quer, não o que a cliente veio fazer — ela já terminou. Uma placa
          branca de 620px sobre tinta rouba a tela do selo, que é o assunto.
        */}
        <div className="mt-10 flex flex-col gap-3">
          <Link
            href={`/agendar/${appointment.unitSlug}` as never}
            className={buttonVariants({ variant: 'on-ink-outline', size: 'xl' })}
          >
            {t.marcarOutro}
          </Link>
          {/*
            A porta da conta dela só aparece quando existe por onde mandar o
            código — a mesma regra de `/conta/entrar`. Oferecer aqui uma área
            que responde "em preparação" seria pior do que não a oferecer.
          */}
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-(--on-ink-muted)">
            {loginClienteDisponivel() ? (
              <>
                <Link href={'/conta' as never} className="transition-colors hover:text-(--on-ink)">
                  {t.asMinhasMarcacoes}
                </Link>
                <span aria-hidden className="text-(--on-ink-accent)">
                  ·
                </span>
              </>
            ) : null}
            <Link href={'/' as never} className="transition-colors hover:text-(--on-ink)">
              {t.voltarAoInicio}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

/**
 * O nome com que o selo cumprimenta, vindo do endereço e não da ficha.
 *
 * O endereço desta tela é a chave: quem o tem, entra. Antes daqui o
 * cumprimento saía de `appointment.clientName`, que é o nome **gravado** —
 * e `findOrCreateClient` reconhece a cliente pelo telemóvel. Bastava marcar
 * com o número de outra pessoa para o selo dizer como ela se chama. Agora o
 * nome é o que foi escrito no formulário, passado por `confirmar/actions.ts`:
 * a pessoa vê de volta o que acabou de digitar, e nada que já estivesse lá.
 *
 * O que chega do endereço é texto de quem quiser escrevê-lo, por isso não é
 * usado como veio: só letras, espaços, hífenes e apóstrofos, e curto. Sem nome
 * legível o cumprimento fica sem nome — nunca com o da ficha.
 */
function primeiroNome(para: string | string[] | undefined): string | null {
  const bruto = (Array.isArray(para) ? para[0] : para)?.trim()
  if (!bruto) return null
  const limpo = bruto.split(/\s+/)[0]?.replace(/[^\p{L}'’-]/gu, '') ?? ''
  return limpo.length > 0 && limpo.length <= 40 ? limpo : null
}
