import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SemLoja } from '@/components/operate/sem-loja'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { requireGestao, unidadesVisiveis } from '@/server/auth/permissoes'
import { countNotices, expireStaleNotices } from '@/server/notifications/queue'
import { ROUTINES } from '@/server/notifications/templates'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * Quem falta avisar, nas duas lojas — ver `/agenda/page.tsx` para o porquê de
 * esta tela existir em vez de um reencaminhamento.
 *
 * Não é a fila: é o mapa dela. A fila tem telefone, mensagem e um botão que fala
 * em nome da loja, e isso mora dentro da loja, onde há uma rotina escolhida e
 * uma pessoa responsável. Aqui só se responde a "sobrou alguém?" — e as rotinas
 * com zero continuam à vista, porque um zero que desaparece obriga a contar as
 * cinco para perceber qual é que faltou.
 */
export default async function AvisosDeTodasAsLojasPage() {
  const acesso = await requireGestao()
  const unidades = unidadesVisiveis(acesso, await listUnits())

  if (unidades.length === 0) return <SemLoja titulo="Avisos" />
  if (unidades.length === 1) redirect(`/avisos/${unidades[0]!.slug}` as never)

  const lojas = await Promise.all(
    unidades.map(async (unit) => {
      /* Fecha as janelas que passaram antes de contar — senão o lembrete de
         ontem aparece como pendente e o painel manda avisar quem já veio. */
      await expireStaleNotices(unit)
      const contagem = await countNotices(unit)
      return {
        unit,
        contagem,
        total: Object.values(contagem).reduce((soma, n) => soma + n, 0),
      }
    }),
  )

  const total = lojas.reduce((soma, loja) => soma + loja.total, 0)

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="display text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">Avisos</h1>
        <p className="text-body mt-2 text-sm">
          {total === 0 ? (
            'Nenhum aviso pendente nas duas lojas. Tudo em dia.'
          ) : (
            <>
              <strong className="tnum text-(--text-strong) font-medium">{total}</strong>{' '}
              {total === 1 ? 'pessoa à espera de aviso' : 'pessoas à espera de aviso'}, ao todo.
            </>
          )}
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {lojas.map(({ unit, contagem, total: daLoja }) => (
          <section key={unit.id} className="surface rounded-card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="display text-[1.25rem] leading-tight font-normal">{unit.name}</h2>
              <p className="text-muted text-sm">
                {daLoja === 0 ? 'em dia' : `${daLoja} por avisar`}
              </p>
            </div>

            {/*
              Cada rotina é uma linha que já é a porta para a fila dela. A dona
              que vê "3 lembretes da véspera" quer é abri-los, e não abrir a loja
              e escolher a aba outra vez — dois toques onde chegava um.
            */}
            <ul className="divide-y divide-(--border-subtle) text-sm">
              {ROUTINES.map((rotina) => {
                const n = contagem[rotina.key]
                return (
                  <li key={rotina.key}>
                    <Link
                      href={href(`/avisos/${unit.slug}?r=${rotina.key}`)}
                      className="flex min-h-11 items-center justify-between gap-3 hover:text-(--text-strong)"
                    >
                      <span className={n === 0 ? 'text-muted' : undefined}>{rotina.label}</span>
                      <span
                        className={cn(
                          'tnum shrink-0 rounded-full px-2 py-0.5 text-xs',
                          n === 0 ? 'text-muted' : 'bg-(--surface-sunken) font-medium',
                        )}
                      >
                        {n}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <Link
              href={href(`/avisos/${unit.slug}`)}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-auto self-start')}
            >
              Abrir fila
            </Link>
          </section>
        ))}
      </div>
    </main>
  )
}
