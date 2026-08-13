import Link from 'next/link'
import { redirect } from 'next/navigation'
import { NoticeQueue } from '@/components/notifications/notice-queue'
import { PainelShell, Vazio } from '@/components/shell/painel-shell'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { podeGerir } from '@/server/auth/permissoes'
import { countNotices, expireStaleNotices, listNotices } from '@/server/notifications/queue'
import { ROUTINES, ROUTINE_BY_KEY, type RoutineKey } from '@/server/notifications/templates'
import { contextoDoPainel } from '@/server/painel/contexto'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Avisos' }

const CHAVES = new Set<string>(ROUTINES.map((routine) => routine.key))

/**
 * A fila de avisos da casa.
 *
 * A casa vem da barra do painel. Antes esta tela era `/avisos/[unidade]`, com
 * um índice `/avisos` por cima só para escolher a loja — a mesma escolha que
 * já tinha sido feita na agenda, cinco minutos antes.
 */
export default async function AvisosPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>
}) {
  const { r } = await searchParams
  const { acesso, unidades, unidade } = await contextoDoPainel()
  if (!podeGerir(acesso)) redirect('/painel/agenda')

  if (!unidade) {
    return (
      <PainelShell
        acesso={acesso}
        unidades={unidades}
        unidade={null}
        activa="avisos"
        titulo="Avisos"
        semCasa
      >
        <Vazio titulo="Nenhuma casa atribuída">Fale com a administração.</Vazio>
      </PainelShell>
    )
  }

  /* Fecha as janelas que passaram antes de contar — senão o lembrete de ontem
     aparece como pendente e a fila vira um cemitério de tarefa vencida. */
  await expireStaleNotices(unidade)

  const rotina: RoutineKey = CHAVES.has(r ?? '') ? (r as RoutineKey) : 'lembrete_vespera'
  const [contagem, avisos] = await Promise.all([
    countNotices(unidade),
    listNotices(unidade, rotina),
  ])

  const meta = ROUTINE_BY_KEY.get(rotina)!
  const total = Object.values(contagem).reduce((soma, n) => soma + n, 0)

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="avisos"
      titulo="Avisos"
      descricao={
        total === 0
          ? 'Tudo em dia'
          : `${total} ${total === 1 ? 'pessoa à espera de aviso' : 'pessoas à espera de aviso'}`
      }
    >
      {/*
        As rotinas são abas, não uma lista só. Misturar "lembrar de amanhã" com
        "pedir avaliação" obriga a recepção a decidir o que fazer a cada linha;
        separado, escolhe o modo uma vez e depois só clica. A contagem fica no
        rótulo porque é o que decide qual aba abrir — aba com zero continua
        clicável, mas sem chamar a atenção.
      */}
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Tipo de aviso">
        {ROUTINES.map((routine) => {
          const n = contagem[routine.key]
          const activa = routine.key === rotina
          return (
            <Link
              key={routine.key}
              href={href(`/painel/avisos?r=${routine.key}`)}
              aria-current={activa ? 'page' : undefined}
              className={cn(
                buttonVariants({ variant: activa ? 'primary' : 'outline', size: 'sm' }),
                n === 0 && !activa && 'text-muted',
              )}
            >
              {routine.label}
              {n > 0 ? (
                <span
                  className={cn(
                    'tnum rounded-full px-1.5 text-xs',
                    activa ? 'bg-(--on-invert)/20' : 'bg-(--surface-sunken)',
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

      <NoticeQueue routine={rotina} notices={avisos} timezone={unidade.timezone} />
    </PainelShell>
  )
}
