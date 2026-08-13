import Link from 'next/link'
import { PainelShell } from '@/components/shell/painel-shell'
import { cn, href } from '@/lib/utils'
import { podeRede, type Acesso } from '@/server/auth/permissoes'
import { contextoDoPainel } from '@/server/painel/contexto'

/**
 * Casca da gestão.
 *
 * A dona entra aqui todos os dias, não uma vez por mês: é onde lê o mês e mexe
 * no que é estrutural (casa, catálogo, equipa, comissão). Por isso é clara,
 * espaçosa e legível de relance — o oposto de uma tela de configuração rara.
 * Continua a valer o desenho original: nada de assistente de várias etapas nos
 * formulários — uma lista, um formulário, guardar.
 *
 * ── O que mudou ───────────────────────────────────────────────────────────
 * Isto era uma casca INDEPENDENTE, com a sua própria barra de topo, ao lado de
 * outras cinco. Agora é uma casca DENTRO do painel: a barra de secções continua
 * à vista à esquerda, e estas abas são a segunda camada — o que se cadastra —,
 * não um sistema à parte com marca própria.
 *
 * As abas dependem de quem entrou. Painel, casas, catálogo e comissões mudam ou
 * resumem as lojas todas de uma vez: são da dona. Equipa e recursos são o que
 * "gerir a unidade" quer dizer na prática, então o gerente vê essas duas —
 * recortadas para as lojas dele.
 */

const TABS = [
  { path: '/painel/gestao', label: 'Painel', rede: false },
  { path: '/painel/gestao/unidades', label: 'Casas', rede: true },
  { path: '/painel/gestao/servicos', label: 'Serviços', rede: true },
  { path: '/painel/gestao/equipe', label: 'Equipa', rede: false },
  { path: '/painel/gestao/recursos', label: 'Recursos', rede: false },
  { path: '/painel/gestao/comissoes', label: 'Comissões', rede: true },
] as const

export type AbaAdmin = (typeof TABS)[number]['path']

export async function AdminShell({
  acesso,
  active,
  title,
  subtitle,
  actions,
  wide,
  children,
}: {
  acesso: Acesso
  active?: AbaAdmin
  title: string
  subtitle?: string
  actions?: React.ReactNode
  /** Só o painel usa: métricas e listas de resumo precisam da faixa toda. */
  wide?: boolean
  children: React.ReactNode
}) {
  const { unidades, unidade } = await contextoDoPainel()
  const tabs = podeRede(acesso) ? TABS : TABS.filter((tab) => !tab.rede)

  return (
    <PainelShell
      acesso={acesso}
      unidades={unidades}
      unidade={unidade}
      activa="gestao"
      titulo={title}
      {...(subtitle ? { descricao: subtitle } : {})}
      {...(actions ? { acao: <div className="flex flex-wrap gap-2">{actions}</div> } : {})}
      /* O cadastro é da rede, não de uma casa: o selector de loja em cima de um
         formulário de catálogo daria a entender que o serviço é de uma só. */
      semCasa
    >
      {/*
        A aba activa é marcada pela régua de bronze, a mesma da barra lateral e
        a mesma que fecha bloco no resto do sistema.
      */}
      <nav className="mb-8 flex flex-wrap gap-1 border-b border-(--border-subtle)">
        {tabs.map((tab) => (
          <Link
            key={tab.path}
            href={href(tab.path)}
            aria-current={active === tab.path ? 'page' : undefined}
            className={cn(
              'rounded-plate -mb-px border-b px-3 py-2.5 text-sm transition-colors',
              active === tab.path
                ? 'border-(--accent) font-medium text-(--text-strong)'
                : 'text-muted border-transparent hover:text-(--text-strong)',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/*
        Coluna de 896px, não de 1152, nas telas de cadastro. Nenhuma delas é
        larga de verdade — são formulários e listas de preço. A 1152 o nome do
        serviço ficava numa ponta e o preço na outra, com um palmo de nada no
        meio, e o olho tem de atravessar o vazio para ligar as duas coisas. O
        painel (`wide`) é a excepção: métricas em faixa e listas de resumo usam
        o espaço extra em vez de sobrar vazio.
      */}
      <div className={cn(wide ? '' : 'max-w-4xl')}>{children}</div>
    </PainelShell>
  )
}

/** Cabeçalho de uma secção do formulário — o "porquê" mora aqui, não no código. */
export function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-plate mb-6 border border-(--border-subtle) bg-(--surface-raised) p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      {hint ? <p className="text-muted mt-1 mb-4 text-sm">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

export function backTo(path: string) {
  return href(path)
}
