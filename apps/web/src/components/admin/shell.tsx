import Link from 'next/link'
import { cn, href } from '@/lib/utils'
import { podeRede, type Acesso } from '@/server/auth/permissoes'

/**
 * Casca dos cadastros e do painel de gestão.
 *
 * A dona entra aqui todo dia, não uma vez por mês: é onde ela lê o mês e mexe
 * no que é estrutural (unidade, catálogo, equipe, comissão). Por isso é clara,
 * espaçosa e legível de relance — o oposto de uma tela de configuração rara.
 * O que continua valendo do desenho original: nada de assistente de várias
 * etapas nos formulários — uma lista, um formulário, salvar.
 *
 * As abas dependem de quem entrou. Painel, unidades, catálogo e comissões
 * mudam ou resumem as três lojas de uma vez: são da dona. Equipe e recursos são
 * o que "gerenciar a unidade" quer dizer na prática, então o gerente vê essas
 * duas — recortadas para as lojas dele.
 */

const TABS = [
  { path: '/admin', label: 'Painel', rede: false },
  { path: '/admin/unidades', label: 'Unidades', rede: true },
  { path: '/admin/servicos', label: 'Serviços', rede: true },
  { path: '/admin/equipe', label: 'Equipe', rede: false },
  { path: '/admin/recursos', label: 'Recursos', rede: false },
  { path: '/admin/comissoes', label: 'Comissões', rede: true },
] as const

export type AbaAdmin = (typeof TABS)[number]['path']

export function AdminShell({
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
  const tabs = podeRede(acesso) ? TABS : TABS.filter((tab) => !tab.rede)

  return (
    /*
      Coluna de 896px, não de 1152, nas telas de cadastro. Nenhuma delas é
      larga de verdade — são formulários e listas de preço. A 1152 o nome do
      serviço ficava numa ponta e o preço na outra, com um palmo de nada no
      meio, e o olho tem de atravessar o vazio para ligar as duas coisas. O
      painel (`wide`) é a exceção: métricas em faixa e listas de resumo usam
      o espaço extra em vez de sobrar vazio.
    */
    <div className={cn('mx-auto w-full px-4 py-8 sm:px-6', wide ? 'max-w-6xl' : 'max-w-4xl')}>
      {/*
        O "← início" saiu: a barra de cima já tem "Hoje", e dois caminhos para o
        mesmo lugar a meio palmo um do outro só fazem a pessoa parar para
        escolher.

        A aba ativa é marcada pela régua de bronze, a mesma da barra de cima e a
        mesma que fecha bloco no resto do sistema. Antes era um traço vinho de
        2px de uma paleta que a marca não usa mais.
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
                ? 'border-(--accent) text-(--text-strong) font-medium'
                : 'text-muted hover:text-(--text-strong) border-transparent',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[1.75rem] leading-[1.15] font-normal sm:text-[2rem]">
            {title}
          </h1>
          {subtitle ? <p className="text-muted mt-1 text-sm">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>

      {children}
    </div>
  )
}

/** Cabeçalho de uma seção do formulário — o "porquê" mora aqui, não no código. */
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
    <section className="surface rounded-card mb-6 p-6">
      <h2 className="text-lg font-medium">{title}</h2>
      {hint ? <p className="text-muted mt-1 mb-4 text-sm">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

export function backTo(path: string) {
  return href(path)
}
