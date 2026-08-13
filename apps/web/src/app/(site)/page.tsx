import Link from 'next/link'
import { UnitPanel } from '@/components/booking/unit-panel'
import { Wordmark } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { Photo } from '@/components/ui/photo'
import { Precario } from '@/components/vitrine/precario'
import { cn, href } from '@/lib/utils'
import { listUnits } from '@/server/scheduling/context'
import { portaDasUnidades } from '@/server/scheduling/hoje'
import { precarioDaRede } from '@/server/vitrine'

export const dynamic = 'force-dynamic'

export const metadata = {
  description:
    'Cabelo, unhas e estética no Nohora Ramirez Beauty Studio. Marque o seu horário online, na casa que lhe fica mais à mão.',
}

/**
 * A página.
 *
 * ── O que esta tela resolve ───────────────────────────────────────────────
 * Antes, quem abria o endereço do estúdio caía no painel da recepção — uma
 * pauta de facturação, atrás de login. A cliente que vinha do Instagram via
 * uma tela de entrar. A vitrine existia, mas escondida em `/loja`, e o
 * agendamento noutro sítio, em `/agendar`. Três moradas para uma casa.
 *
 * Agora a morada é uma só e responde às três perguntas que a cliente traz, por
 * esta ordem: que casa é esta, onde ficam, e quanto custa. A marcação está a
 * um toque de qualquer uma delas.
 */
export default async function HomePage() {
  const unidades = await listUnits()
  const [portas, precario] = await Promise.all([
    portaDasUnidades(unidades),
    precarioDaRede(unidades),
  ])

  const capa = unidades.find((unidade) => unidade.imageUrl) ?? unidades[0]

  return (
    <>
      {/*
        A capa é fotografia em sangria com o logotipo por cima do véu — não um
        bloco de cor com um título centrado. A sala é o argumento de venda de
        um salão; pô-la atrás de um título é enterrar o que faz decidir.
      */}
      <section className="relative isolate">
        <Photo
          src={capa?.imageUrl ?? null}
          alt=""
          name={capa?.name ?? 'Nohora Ramirez'}
          priority
          sizes="100vw"
          className="h-[clamp(24rem,72vh,42rem)] w-full"
        />
        <div className="scrim-photo absolute inset-0" aria-hidden />

        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-5 pb-10 text-(--on-ink) sm:px-8 sm:pb-16">
            <Wordmark size="lg" align="left" />

            <p className="measure mt-6 text-[1.0625rem] leading-relaxed text-(--on-ink-muted) sm:mt-7 sm:text-[1.1875rem]">
              Cabelo, unhas e estética em {escreverCasas(unidades.map((u) => u.district ?? u.name))}.
              Escolha a pessoa, a hora e a casa — o resto tratamos nós.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={href('/marcar')}
                className={buttonVariants({ variant: 'on-ink', size: 'xl' })}
              >
                Marcar horário
              </Link>
              <Link
                href={href('/#precario')}
                className={buttonVariants({ variant: 'on-ink-outline', size: 'xl' })}
              >
                Ver o preçário
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── as casas ────────────────────────────────────────────────────── */}
      <section id="casas" className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 className="display display-lg">
            {unidades.length === 1 ? 'A casa' : `${unidades.length === 2 ? 'Duas' : unidades.length} casas`}
          </h2>
          <p className="text-body measure text-[0.9375rem]">
            A mesma equipa e o mesmo preçário base. O que muda é a rua — e a agenda, que é de cada
            casa.
          </p>
        </div>

        <ul className={cn('mt-9 grid gap-5 sm:gap-6', colunas(unidades.length))}>
          {unidades.map((unidade, indice) => (
            <li key={unidade.id}>
              <UnitPanel
                unit={unidade}
                hoje={portas.get(unidade.id)}
                href={`/casa/${unidade.slug}`}
                priority={indice === 0}
                sizes={sizesPara(unidades.length)}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* ── preçário ────────────────────────────────────────────────────── */}
      {precario.length > 0 ? (
        <section
          id="precario"
          className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-16 sm:px-8 sm:pb-24"
        >
          <div className="border-t border-(--border-strong) pt-10 sm:pt-14">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <h2 className="display display-lg">Preçário</h2>
              <p className="text-body measure text-[0.9375rem]">
                Preço final na marcação, já com a profissional escolhida — nunca acima do que está
                aqui.
              </p>
            </div>

            <div className="mt-10 sm:mt-14">
              <Precario grupos={precario} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── a última chamada ────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-4 sm:px-8">
        <div className="rounded-plate bg-(--surface-ink) px-6 py-12 text-center text-(--on-ink) [--focus:var(--on-ink-accent)] sm:px-10 sm:py-16">
          <h2 className="display display-md">A agenda está aberta.</h2>
          <p className="text-(--on-ink-muted) mx-auto mt-3 max-w-[46ch] text-[0.9375rem]">
            Marque em menos de um minuto, veja os horários livres de verdade e receba a confirmação
            na hora.
          </p>
          <Link
            href={href('/marcar')}
            className={cn(buttonVariants({ variant: 'on-ink', size: 'xl' }), 'mt-8')}
          >
            Marcar horário
          </Link>
        </div>
      </section>
    </>
  )
}

/*
  Duas lojas lado a lado é um díptico: cada uma ocupa metade da parede e
  nenhuma pede desculpa pelo tamanho. Três viram um tríptico. A partir de
  quatro a peça encolhe até virar cartão — e aí esta secção precisa de outro
  desenho, não de mais uma coluna. O limite está escrito para quem abrir a
  quinta loja ler isto antes de reclamar.
*/
function colunas(total: number): string {
  if (total <= 1) return 'mx-auto max-w-3xl'
  if (total === 2) return 'sm:grid-cols-2'
  return 'sm:grid-cols-2 lg:grid-cols-3'
}

function sizesPara(total: number): string {
  if (total <= 1) return '(min-width: 768px) 768px, 100vw'
  if (total === 2) return '(min-width: 1152px) 560px, (min-width: 640px) 48vw, 100vw'
  return '(min-width: 1152px) 368px, (min-width: 640px) 48vw, 100vw'
}

/** "Valongo e na Maia" — a lista como uma pessoa a diria, não com vírgulas. */
function escreverCasas(nomes: readonly string[]): string {
  if (nomes.length === 0) return 'duas casas'
  if (nomes.length === 1) return nomes[0]!
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
