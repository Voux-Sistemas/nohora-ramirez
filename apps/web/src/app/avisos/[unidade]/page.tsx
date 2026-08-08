import Link from 'next/link'
import { notFound } from 'next/navigation'
import { NoticeQueue } from '@/components/notifications/notice-queue'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { requireGestao, requireUnidade } from '@/server/auth/permissoes'
import { countNotices, expireStaleNotices, listNotices } from '@/server/notifications/queue'
import { ROUTINES, ROUTINE_BY_KEY, type RoutineKey } from '@/server/notifications/templates'
import { getUnitBySlug } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

const CHAVES = new Set<string>(ROUTINES.map((routine) => routine.key))

export default async function AvisosDaUnidadePage({
  params,
  searchParams,
}: {
  params: Promise<{ unidade: string }>
  searchParams: Promise<{ r?: string }>
}) {
  const acesso = await requireGestao()
  const { unidade } = await params
  const { r } = await searchParams

  const unit = await getUnitBySlug(unidade)
  if (!unit) notFound()
  requireUnidade(acesso, unit.id)

  // Fecha as janelas que passaram antes de contar — senão o lembrete de ontem
  // aparece como pendente e a fila vira um cemitério de tarefa vencida.
  await expireStaleNotices(unit)

  const rotina: RoutineKey = CHAVES.has(r ?? '') ? (r as RoutineKey) : 'lembrete_vespera'
  const [contagem, avisos] = await Promise.all([
    countNotices(unit),
    listNotices(unit, rotina),
  ])

  const meta = ROUTINE_BY_KEY.get(rotina)!
  const total = Object.values(contagem).reduce((soma, n) => soma + n, 0)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        {/* Sem volta para uma lista de uma loja só: o link levaria a um
            redirecionamento de volta para esta mesma tela. */}
        {acesso.unidadeIds !== null && acesso.unidadeIds.length <= 1 ? null : (
          <Link href={href('/avisos')} className="text-muted text-sm hover:underline">
            ← unidades
          </Link>
        )}
        <h1 className="display mt-1 text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">
          Avisos · {unit.name}
        </h1>
        <p className="text-body mt-2 text-sm">
          {total === 0 ? (
            'Nenhum aviso pendente. Tudo em dia.'
          ) : (
            <>
              <strong className="tnum text-(--text-strong) font-medium">{total}</strong>{' '}
              {total === 1 ? 'pessoa esperando aviso' : 'pessoas esperando aviso'}
            </>
          )}
        </p>
      </header>

      {/*
        As rotinas são abas, não uma lista só.
        Misturar "lembrar de amanhã" com "pedir avaliação" obriga a recepção a
        decidir o que fazer a cada linha; separado, ela escolhe o modo uma vez e
        depois só clica. A contagem fica no rótulo porque é o que decide qual
        aba abrir — aba com zero continua clicável, mas sem chamar atenção.
      */}
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Tipo de aviso">
        {ROUTINES.map((routine) => {
          const n = contagem[routine.key]
          const ativa = routine.key === rotina
          return (
            <Link
              key={routine.key}
              href={href(`/avisos/${unit.slug}?r=${routine.key}`)}
              aria-current={ativa ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: ativa ? 'primary' : 'outline', size: 'sm' }),
                n === 0 && !ativa && 'text-muted',
              )}
            >
              {routine.label}
              {n > 0 ? (
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 text-xs',
                    ativa ? 'bg-(--on-invert)/20' : 'bg-(--surface-sunken)',
                  )}
                >
                  {n}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>

      <p className="text-muted mb-4 text-sm">{meta.hint}</p>

      <NoticeQueue routine={rotina} notices={avisos} timezone={unit.timezone} />
    </main>
  )
}
