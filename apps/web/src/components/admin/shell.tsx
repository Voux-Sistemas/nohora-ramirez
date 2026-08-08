import Link from 'next/link'
import { cn, href } from '@/lib/utils'
import { podeRede, type Acesso } from '@/server/auth/permissoes'

/**
 * Casca dos cadastros.
 *
 * O admin é a tela que a dona abre uma vez por mês — então ela é larga, densa e
 * sem gracinha. Nada de assistente de várias etapas: uma lista, um formulário,
 * salvar.
 *
 * As abas dependem de quem entrou. Unidades, catálogo e comissões mudam as três
 * lojas de uma vez: são da dona. Equipe e recursos são o que "gerenciar a
 * unidade" quer dizer na prática, então o gerente vê essas duas — recortadas
 * para as lojas dele.
 */

const TABS = [
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
  children,
}: {
  acesso: Acesso
  active?: AbaAdmin
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const tabs = podeRede(acesso) ? TABS : TABS.filter((tab) => !tab.rede)

  return (
    /*
      Coluna de 896px, não de 1152. Nenhuma tela daqui é larga de verdade —
      são formulários e listas de preço. A 1152 o nome do serviço ficava numa
      ponta e o preço na outra, com um palmo de nada no meio, e o olho tem de
      atravessar o vazio para ligar as duas coisas. É o mesmo conserto da tela
      de hoje, na largura que os formulários de duas colunas ainda aguentam.
    */
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
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
    <section className="surface rounded-card mb-5 p-5">
      <h2 className="font-medium">{title}</h2>
      {hint ? <p className="text-muted mt-0.5 mb-4 text-sm">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}

export function backTo(path: string) {
  return href(path)
}
