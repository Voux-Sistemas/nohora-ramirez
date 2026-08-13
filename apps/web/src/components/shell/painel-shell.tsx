import {
  Bell,
  CalendarDays,
  LayoutList,
  Settings2,
  Sun,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { UnitSwitcher } from '@/components/shell/unit-switcher'
import { cn, href } from '@/lib/utils'
import { sair } from '@/server/auth/actions'
import { podeGerir, type Acesso } from '@/server/auth/permissoes'
import type { UnitInfo } from '@/server/scheduling/context'

/**
 * A casca da equipa.
 *
 * ── O que mudou e porquê ──────────────────────────────────────────────────
 * Antes havia seis endereços de topo (`/`, `/agenda`, `/avisos`, `/caixa`,
 * `/clientes`, `/admin`), cada um com a sua própria tela de "escolha a
 * unidade" antes de mostrar seja o que for, e o `/admin` ainda tinha uma
 * segunda casca por dentro. Trocar de secção era voltar ao princípio.
 *
 * Agora é uma casca só: a lista de secções está sempre à vista, a casa é
 * escolhida uma vez na barra e vale para todas, e o conteúdo é a única coisa
 * que muda. Quem está de pé no balcão nunca perde o lugar.
 *
 * A barra lateral é de tinta — a cor da marca, a mesma faixa que a cliente vê
 * no telemóvel. O conteúdo é pedra clara e forçada (`data-theme="light"`):
 * preço, caixa e comissão não podem depender de a pessoa ter o telemóvel em
 * modo escuro.
 */

export type SecaoPainel = 'hoje' | 'agenda' | 'clientes' | 'caixa' | 'avisos' | 'gestao'

interface Secao {
  id: SecaoPainel
  path: string
  label: string
  /** Nome curto, para a barra do telemóvel. */
  curto: string
  icon: LucideIcon
}

const OPERACAO: Secao[] = [
  { id: 'hoje', path: '/painel', label: 'Hoje', curto: 'Hoje', icon: Sun },
  {
    id: 'agenda',
    path: '/painel/agenda',
    label: 'A minha agenda',
    curto: 'Agenda',
    icon: CalendarDays,
  },
  { id: 'clientes', path: '/painel/clientes', label: 'Clientes', curto: 'Clientes', icon: Users },
  { id: 'caixa', path: '/painel/caixa', label: 'Caixa', curto: 'Caixa', icon: Wallet },
]

const ADMINISTRAR: Secao[] = [
  { id: 'avisos', path: '/painel/avisos', label: 'Avisos', curto: 'Avisos', icon: Bell },
  { id: 'gestao', path: '/painel/gestao', label: 'Gestão', curto: 'Gestão', icon: Settings2 },
]

/**
 * A barra é o rosto da permissão: o que a pessoa não pode abrir não aparece.
 * Esconder é cortesia, não segurança — o porteiro real está em cada tela. Mas
 * uma barra que oferece o que vai dar em redireccionamento ensina a desconfiar
 * de todos os botões por causa de um.
 */
function secoesDe(acesso: Acesso): { operacao: Secao[]; administrar: Secao[] } {
  if (!podeGerir(acesso)) {
    return {
      operacao: [
        {
          id: 'agenda',
          path: '/painel/agenda',
          label: 'A minha agenda',
          curto: 'Agenda',
          icon: CalendarDays,
        },
      ],
      administrar: [],
    }
  }
  return { operacao: OPERACAO, administrar: ADMINISTRAR }
}

export function PainelShell({
  acesso,
  unidades,
  unidade,
  activa,
  titulo,
  descricao,
  acao,
  /** Telas que não são de uma casa só — a pauta da rede, o cadastro. */
  semCasa = false,
  children,
}: {
  acesso: Acesso
  unidades: readonly UnitInfo[]
  unidade: UnitInfo | null
  activa: SecaoPainel
  titulo: string
  descricao?: string
  /** Acção principal da tela, alinhada ao título. */
  acao?: React.ReactNode
  semCasa?: boolean
  children: React.ReactNode
}) {
  const { operacao, administrar } = secoesDe(acesso)
  const todas = [...operacao, ...administrar]

  return (
    <div data-theme="light" className="flex min-h-dvh flex-col bg-(--surface) lg:flex-row">
      {/* ── barra lateral, a partir de lg ────────────────────────────────── */}
      <aside className="hidden bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col">
        <Link
          href={href(todas[0]!.path)}
          className="rounded-plate mx-5 mt-6 mb-7 shrink-0"
          aria-label="Nohora Ramirez — painel"
        >
          <Wordmark size="sm" align="left" />
        </Link>

        <nav aria-label="Secções" className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-3">
          <Grupo itens={operacao} activa={activa} />
          {administrar.length > 0 ? (
            <Grupo itens={administrar} activa={activa} titulo="Administrar" />
          ) : null}
        </nav>

        {/* Quem está ligado, e a saída. No fim, porque é onde se procura. */}
        <div className="mt-6 shrink-0 border-t border-(--border-on-ink) px-5 py-4">
          <p className="truncate text-sm font-medium">{acesso.session.name}</p>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-xs text-(--on-ink-muted)">{PAPEL[acesso.papel]}</span>
            <form action={sair}>
              <button
                type="submit"
                className="rounded-plate text-xs text-(--on-ink-muted) underline-offset-4 transition-colors hover:text-(--on-ink) hover:underline"
              >
                sair
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* ── barra de topo, abaixo de lg ──────────────────────────────────── */}
      <div className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)] lg:hidden">
        <div className="flex items-center gap-3 px-4 pt-3">
          <Wordmark size="sm" align="left" />
          <form action={sair} className="ml-auto">
            <button
              type="submit"
              className="rounded-plate min-h-11 px-1 text-sm text-(--on-ink-muted) transition-colors hover:text-(--on-ink)"
            >
              sair
            </button>
          </form>
        </div>
        <nav
          aria-label="Secções"
          className="flex items-stretch gap-1 overflow-x-auto px-2 pb-0.5"
        >
          {todas.map((secao) => {
            const atual = activa === secao.id
            return (
              <Link
                key={secao.id}
                href={href(secao.path)}
                aria-current={atual ? 'page' : undefined}
                className={cn(
                  'rounded-plate relative flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm whitespace-nowrap transition-colors',
                  atual ? 'font-medium text-(--on-ink)' : 'text-(--on-ink-muted) hover:text-(--on-ink)',
                )}
              >
                <secao.icon aria-hidden className="size-4" strokeWidth={1.75} />
                {secao.curto}
                {atual ? (
                  <span aria-hidden className="absolute inset-x-2 bottom-0 h-px bg-(--on-ink-accent)" />
                ) : null}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── conteúdo ─────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/*
          O cabeçalho gruda: o título diz onde se está e o selector da casa
          diz de quem é o número que está na tela. Numa lista longa de clientes
          ou numa agenda de doze horas, perder os dois ao rolar é o que faz
          alguém lançar dinheiro na loja errada.
        */}
        <header className="sticky top-0 z-(--z-sticky) border-b border-(--border-subtle) bg-(--surface)/92 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-medium">{titulo}</h1>
              {descricao ? (
                <p className="text-muted truncate text-sm first-letter:uppercase">{descricao}</p>
              ) : null}
            </div>

            {!semCasa && unidade ? (
              <UnitSwitcher unidades={unidades} activa={unidade.slug} />
            ) : null}
            {acao}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}

function Grupo({
  itens,
  activa,
  titulo,
}: {
  itens: Secao[]
  activa: SecaoPainel
  titulo?: string
}) {
  return (
    <div>
      {titulo ? (
        <h2 className="px-3 pb-2 text-[0.6875rem] font-semibold tracking-[0.14em] text-(--on-ink-muted) uppercase">
          {titulo}
        </h2>
      ) : null}
      <ul className="flex flex-col gap-0.5">
        {itens.map((secao) => {
          const atual = activa === secao.id
          return (
            <li key={secao.id}>
              <Link
                href={href(secao.path)}
                aria-current={atual ? 'page' : undefined}
                className={cn(
                  'rounded-plate flex min-h-11 items-center gap-3 px-3 text-sm transition-colors',
                  atual
                    ? 'bg-(--on-ink)/10 font-medium text-(--on-ink)'
                    : 'text-(--on-ink-muted) hover:bg-(--on-ink)/6 hover:text-(--on-ink)',
                )}
              >
                <secao.icon
                  aria-hidden
                  className={cn('size-[1.125rem] shrink-0', atual && 'text-(--on-ink-accent)')}
                  strokeWidth={1.75}
                />
                {secao.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const PAPEL: Record<Acesso['papel'], string> = {
  suporte: 'Suporte',
  dona: 'Direcção',
  gerente: 'Gerência',
  profissional: 'Equipa',
}

/**
 * Vazio de secção. Existe aqui, e não em cada tela, porque a frase certa
 * depende de quem está a ler — e essa é a informação que a casca tem.
 */
export function Vazio({
  titulo,
  children,
  icon: Icon = LayoutList,
}: {
  titulo: string
  children?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="rounded-plate border border-dashed border-(--border-strong) px-6 py-14 text-center">
      <Icon aria-hidden className="text-muted mx-auto size-6" strokeWidth={1.5} />
      <p className="mt-3 font-medium">{titulo}</p>
      {children ? <div className="text-muted measure mx-auto mt-1.5 text-sm">{children}</div> : null}
    </div>
  )
}
