import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { EstadoDoCaixa } from '@/components/caixa/estado'
import { SemLoja } from '@/components/operate/sem-loja'
import { buttonVariants } from '@/components/ui/button'
import { formatDateLong, formatMoney, formatTime } from '@/lib/format'
import { cn, href } from '@/lib/utils'
import { requireGestao, unidadesVisiveis } from '@/server/auth/permissoes'
import { getOpenSession, listMovements } from '@/server/finance/caixa'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * As duas gavetas numa tela — ver `/agenda/page.tsx` para o porquê de existir.
 *
 * A pergunta que traz alguém aqui é sempre a mesma e é de fim de tarde: já
 * fecharam? A resposta tem de caber num relance, e por isso o estado vem antes
 * do dinheiro e em forma, não em número.
 *
 * O que esta tela não faz é mexer na gaveta. Abrir, lançar e fechar continuam
 * dentro da loja: são gestos com testemunha e com hora, e um botão de "abrir"
 * num painel de duas lojas é um convite a abrir a errada.
 */
export default async function CaixaDeTodasAsLojasPage() {
  const acesso = await requireGestao()
  const unidades = unidadesVisiveis(acesso, await listUnits())

  if (unidades.length === 0) return <SemLoja titulo="Caixa" />
  if (unidades.length === 1) redirect(`/caixa/${unidades[0]!.slug}` as never)

  const lojas = await Promise.all(
    unidades.map(async (unit) => {
      const session = await getOpenSession(unit.id)
      const movimentos = session ? await listMovements(session.id) : []
      /* A mesma soma de `closeSession` e da tela da loja: abertura + pagamentos
         e reforços − sangrias. Fechar só confirma o que já está aqui. */
      const saldo = session
        ? session.openingAmount +
          movimentos.reduce((soma, m) => soma + (m.type === 'withdrawal' ? -m.amount : m.amount), 0)
        : 0
      return { unit, session, saldo, movimentos: movimentos.length }
    }),
  )

  const abertas = lojas.filter((loja) => loja.session !== null)
  const emCaixa = abertas.reduce((soma, loja) => soma + loja.saldo, 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-8">
        <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">Caixa</h1>
        <p className="text-body mt-2 text-sm">
          {abertas.length === 0 ? (
            'Nenhuma gaveta aberta neste momento.'
          ) : (
            <>
              {abertas.length} de {lojas.length} gavetas abertas, com{' '}
              <strong className="tnum text-(--text-strong) font-medium">
                {formatMoney(emCaixa)}
              </strong>{' '}
              ao todo.
            </>
          )}
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        {lojas.map(({ unit, session, saldo, movimentos }) => (
          <section key={unit.id} className="surface rounded-card flex flex-col gap-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="display text-[1.25rem] leading-tight font-normal">{unit.name}</h2>
              <EstadoDoCaixa aberto={session !== null} />
            </div>

            {session ? (
              <div>
                <p className="label-caps text-muted">Saldo em caixa</p>
                <p className="display tnum mt-1 text-[2rem] leading-none">{formatMoney(saldo)}</p>
                <p className="text-muted tnum mt-2 text-sm">
                  Abertura {formatMoney(session.openingAmount)} · desde{' '}
                  {formatDateLong(isoDateInZone(session.openedAt, unit.timezone))}{' '}
                  {formatTime(session.openedAt, unit.timezone)}
                  {movimentos > 0
                    ? ` · ${movimentos} movimento${movimentos === 1 ? '' : 's'}`
                    : ' · sem movimentos'}
                </p>
              </div>
            ) : (
              <p className="text-muted text-sm">
                Nada registado hoje. A gaveta abre-se dentro da loja, com o valor que lá está.
              </p>
            )}

            <Link
              href={href(`/caixa/${unit.slug}`)}
              className={cn(
                buttonVariants({ variant: session ? 'outline' : 'primary', size: 'sm' }),
                'mt-auto self-start',
              )}
            >
              {session ? 'Ver movimentos' : 'Abrir caixa'}
            </Link>
          </section>
        ))}
      </div>
    </div>
  )
}
