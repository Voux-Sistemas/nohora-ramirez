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
 * As seis seções dependem de quem entrou. Painel, unidades, catálogo e
 * comissões mudam ou resumem as três lojas de uma vez: são da dona. Equipe e
 * recursos são o que "gerenciar a unidade" quer dizer na prática, então o
 * gerente vê essas duas — recortadas para as lojas dele.
 *
 * A navegação vive à esquerda em telas largas, sempre visível — é o desenho
 * de um sistema de gestão de verdade (a mesma casa de Mangomint e Boulevard,
 * as referências fixadas em `PRODUCT.md`), e tira uma das três faixas
 * horizontais que ficavam entre a barra de cima e o primeiro número. Abaixo
 * de `lg` ela desce para o rolador horizontal que já existia.
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

function NavLateral({ tabs, active }: { tabs: readonly (typeof TABS)[number][]; active?: AbaAdmin }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {tabs.map((tab) => (
        <li key={tab.path}>
          <Link
            href={href(tab.path)}
            aria-current={active === tab.path ? 'page' : undefined}
            className={cn(
              'block rounded-plate border-l-2 py-2 pr-3 pl-3.5 text-sm transition-colors',
              active === tab.path
                ? 'border-(--accent) text-(--text-strong) font-medium'
                : 'text-muted hover:text-(--text-strong) border-transparent',
            )}
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function NavRolador({ tabs, active }: { tabs: readonly (typeof TABS)[number][]; active?: AbaAdmin }) {
  return (
    <ul className="flex min-w-max gap-1 border-b border-(--border-subtle)">
      {tabs.map((tab) => (
        <li key={tab.path}>
          <Link
            href={href(tab.path)}
            aria-current={active === tab.path ? 'page' : undefined}
            className={cn(
              'rounded-plate -mb-px block border-b px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
              active === tab.path
                ? 'border-(--accent) text-(--text-strong) font-medium'
                : 'text-muted hover:text-(--text-strong) border-transparent',
            )}
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

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
    <div className="mx-auto flex w-full max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:py-10">
      {/*
        Só em `lg+`: sempre à vista, porque são seis destinos fixos que a dona
        troca o dia inteiro — esconder atrás de um menu custaria um toque a
        cada troca. `sticky` para acompanhar a rolagem de fichas longas sem
        desaparecer.
      */}
      <nav aria-label="Secções da gestão" className="hidden w-44 shrink-0 lg:block">
        <div className="sticky top-8">
          <NavLateral tabs={tabs} active={active} />
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {/* Abaixo de `lg`: o rolador horizontal, com a régua de bronze que já
            marca o trecho ativo no resto do sistema. */}
        <nav aria-label="Secções da gestão" className="-mx-4 mb-8 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
          <NavRolador tabs={tabs} active={active} />
        </nav>

        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
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
    </div>
  )
}

/**
 * Cabeçalho de uma seção do formulário ou da lista — o "porquê" mora aqui,
 * não no código.
 *
 * Título e régua de bronze fecham a linha, a mesma assinatura gráfica que
 * separa categoria de serviço no agendamento da cliente (`ServicePicker`).
 * Deixou de ser uma caixa (`surface rounded-card`): dentro de `AdminShell`,
 * que já não tem parede nenhuma, uma seção-caixa só existia para desenhar
 * card dentro de card — a régua faz a mesma separação sem duplicar moldura.
 */
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
    <section className="mb-10">
      <div className="flex items-baseline gap-4">
        <h2 className="shrink-0 text-lg font-medium">{title}</h2>
        <span className="rule-bronze min-w-0 flex-1" aria-hidden />
      </div>
      {hint ? <p className="text-muted mt-2 mb-5 text-sm">{hint}</p> : <div className="mb-5" />}
      {children}
    </section>
  )
}

export function backTo(path: string) {
  return href(path)
}
