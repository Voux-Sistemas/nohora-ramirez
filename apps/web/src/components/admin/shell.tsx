import Link from 'next/link'
import { cn, href } from '@/lib/utils'
import { podeRede, type Acesso } from '@/server/auth/permissoes'

/**
 * Casca da gestão — e ela é de computador, de propósito.
 *
 * A dona gere o salão sentada, num ecrã largo. Quem trabalha de pé, no telemóvel
 * ou no tablet, é a profissional (a agenda dela) e a cliente (o agendamento) —
 * essas telas continuam a ser desenhadas primeiro para a mão. Aqui é o
 * contrário: a medida é a mesa, e o que existe abaixo de `lg` é uma queda
 * digna, não o desenho principal.
 *
 * Foi a queixa concreta dela: a área de gestão estava numa coluna estreita ao
 * centro, com margens vazias dos dois lados e tudo empilhado — a forma de um
 * telemóvel esticado. O que muda: a moldura passa a 90rem, o rail vira uma
 * coluna fixa com fio próprio, e o conteúdo ganha largura para se organizar em
 * colunas em vez de fila indiana.
 *
 * O rail agrupa por quem manda no quê, não por ordem alfabética. "A rede" muda
 * as lojas todas de uma vez e é assunto da dona; "A loja" é o que gerir uma
 * unidade quer dizer na prática, e por isso o gerente também vê. Para ele o
 * primeiro grupo não aparece — o rail é o rosto da permissão, como sempre foi.
 */

const GRUPOS = [
  {
    titulo: null,
    tabs: [{ path: '/admin', label: 'Painel', rede: false }],
  },
  {
    titulo: 'A rede',
    tabs: [
      { path: '/admin/unidades', label: 'Unidades', rede: true },
      { path: '/admin/servicos', label: 'Serviços', rede: true },
      { path: '/admin/comissoes', label: 'Comissões', rede: true },
    ],
  },
  {
    titulo: 'A loja',
    tabs: [
      { path: '/admin/equipe', label: 'Equipe', rede: false },
      { path: '/admin/recursos', label: 'Recursos', rede: false },
    ],
  },
] as const

type Tab = (typeof GRUPOS)[number]['tabs'][number]
export type AbaAdmin = Tab['path']

function visiveis(acesso: Acesso) {
  const rede = podeRede(acesso)
  return GRUPOS.map((grupo) => ({
    titulo: grupo.titulo,
    tabs: grupo.tabs.filter((tab) => rede || !tab.rede) as readonly Tab[],
  })).filter((grupo) => grupo.tabs.length > 0)
}

/** O rail de computador: sempre à vista, agrupado, e acompanha a rolagem. */
function Rail({ grupos, active }: { grupos: ReturnType<typeof visiveis>; active?: AbaAdmin }) {
  return (
    <div className="flex flex-col gap-7">
      {grupos.map((grupo, i) => (
        <div key={grupo.titulo ?? `grupo-${i}`}>
          {grupo.titulo ? <p className="label-caps text-muted mb-2 pl-3">{grupo.titulo}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {grupo.tabs.map((tab) => {
              const atual = active === tab.path
              return (
                <li key={tab.path}>
                  <Link
                    href={href(tab.path)}
                    aria-current={atual ? 'page' : undefined}
                    className={cn(
                      'rounded-plate relative block py-1.5 pr-3 pl-3 text-sm transition-colors',
                      atual
                        ? 'bg-(--surface-raised) text-(--text-strong) font-medium'
                        : 'text-muted hover:text-(--text-strong) hover:bg-(--surface-raised)/60',
                    )}
                  >
                    {/* A régua de bronze, de pé: a mesma marca de trecho ativo
                        que a barra de cima usa deitada. */}
                    {atual ? (
                      <span
                        aria-hidden
                        className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-(--accent)"
                      />
                    ) : null}
                    {tab.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Abaixo de `lg`: os mesmos destinos numa fita que rola. Sem os títulos de
 *  grupo, que a essa largura custariam mais altura do que orientam. */
function Fita({ grupos, active }: { grupos: ReturnType<typeof visiveis>; active?: AbaAdmin }) {
  const tabs = grupos.flatMap((grupo) => grupo.tabs)
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
  /** Um facto curto, não uma frase de manual: "7 pessoas · 6 ativas". O rail já
   *  diz onde ela está; o cabeçalho diz o tamanho do que está a olhar. */
  meta,
  actions,
  children,
}: {
  acesso: Acesso
  active?: AbaAdmin
  title: string
  meta?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const grupos = visiveis(acesso)

  return (
    <div className="mx-auto flex w-full max-w-[90rem]">
      <nav
        aria-label="Secções da gestão"
        className="hidden shrink-0 border-r border-(--border-subtle) lg:block lg:w-48 xl:w-56"
      >
        {/* `pl-5` + os 12px de dentro do link põem o texto do rail nos mesmos
            32px da esquerda em que a barra de cima assenta o logótipo. */}
        <div className="sticky top-0 py-9 pr-5 pl-5">
          <Rail grupos={grupos} active={active} />
        </div>
      </nav>

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-9 xl:px-10">
        <nav
          aria-label="Secções da gestão"
          className="-mx-4 mb-7 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden"
        >
          <Fita grupos={grupos} active={active} />
        </nav>

        <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="display text-[1.625rem] leading-none font-normal sm:text-3xl">
              {title}
            </h1>
            {meta ? <p className="text-muted tnum text-sm">{meta}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>

        {children}
      </div>
    </div>
  )
}

/**
 * O corpo de uma ficha (unidade, profissional, serviço).
 *
 * Uma lista quer toda a largura da mesa; um formulário, não. Com a moldura a
 * 90rem, um campo "Telefone" esticado a 700px fica ridículo e a pessoa perde
 * o rótulo de vista ao chegar ao fim do campo. A ficha tem por isso medida
 * própria — larga o suficiente para duas ou três colunas de campos, curta o
 * suficiente para se ler de uma vez.
 *
 * O caminho de volta vem junto: é sempre o mesmo gesto no topo de qualquer
 * ficha, e tê-lo aqui evita que cada tela o escreva à sua maneira.
 */
export function Ficha({
  voltarPara,
  voltarLabel,
  children,
}: {
  voltarPara: AbaAdmin
  voltarLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="max-w-4xl">
      <Link
        href={href(voltarPara)}
        className="text-muted mb-5 inline-block text-sm transition-colors hover:text-(--text-strong)"
      >
        ← {voltarLabel}
      </Link>
      {children}
    </div>
  )
}

/**
 * Cabeçalho de um bloco: título, régua de bronze e — quando faz sentido — o
 * atalho para o assunto inteiro, na mesma linha.
 *
 * A `hint` continua a existir, mas passou a ser exceção. Uma frase explicativa
 * debaixo de cada bloco, em todas as telas, era metade da sensação de
 * "informação a mais": texto a competir com o número que a dona veio ler. Onde
 * o título já diz, o título basta.
 */
export function Section({
  title,
  hint,
  actions,
  className,
  children,
}: {
  title: string
  hint?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    /* O respiro entre blocos vive aqui e não em cada tela — quem monta um
       bloco dentro de uma grelha, que já tem `gap`, passa `mb-0`. */
    <section className={cn('mb-9', className)}>
      <div className="flex items-baseline gap-4">
        <h2 className="shrink-0 text-base font-medium">{title}</h2>
        <span className="rule-bronze min-w-0 flex-1" aria-hidden />
        {actions ? <div className="shrink-0 text-sm">{actions}</div> : null}
      </div>
      {hint ? <p className="text-muted mt-2 text-sm">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
