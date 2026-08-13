import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { getSession } from '@/server/auth/session'

/**
 * A barra da casa.
 *
 * O sistema tinha oito entradas de topo — `/`, `/agendar`, `/loja`, `/conta`,
 * `/entrar`, `/comecar` — e cada uma abria numa casca diferente, com marca
 * diferente e sem caminho de volta. Quem chegava pelo Instagram não sabia se
 * estava na loja, no agendamento ou no login.
 *
 * Agora a cliente tem quatro lugares e esta barra os carrega todos: a página
 * (`/`), a casa (`/casa/…`), a marcação (`/marcar`) e a conta
 * (`/minha-conta`). A barra é a mesma em todos, então voltar é sempre possível
 * e nunca é preciso adivinhar onde se está.
 *
 * Faixa de tinta porque é a cor da marca — a mesma que a recepção vê no
 * painel. Vitrine e oficina são a mesma casa em duas temperaturas.
 */
export async function SiteHeader({ ativo }: { ativo?: 'casas' | 'precario' | 'conta' }) {
  const session = await getSession()
  const eCliente = Boolean(session?.clientId)

  return (
    <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-5 py-3 sm:gap-6 sm:px-8">
        <Link href="/" className="rounded-plate shrink-0 py-1" aria-label="Nohora Ramirez — início">
          <Wordmark size="sm" align="left" />
        </Link>

        {/*
          Âncoras, não páginas. "As casas" e "Preçário" são secções da própria
          home — pôr cada uma numa rota própria era exatamente o que fazia o
          sistema parecer um monte de telas soltas.
        */}
        <nav aria-label="Secções" className="ml-auto hidden items-center gap-1 md:flex">
          <ItemBarra hrefTo="/#casas" atual={ativo === 'casas'}>
            As casas
          </ItemBarra>
          <ItemBarra hrefTo="/#precario" atual={ativo === 'precario'}>
            Preçário
          </ItemBarra>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0 sm:gap-3">
          <ItemBarra hrefTo={eCliente ? '/minha-conta' : '/entrar'} atual={ativo === 'conta'}>
            {eCliente ? 'A minha conta' : 'Entrar'}
          </ItemBarra>

          {/*
            Sobre a faixa de tinta quem age é a pedra clara — botão de tinta
            sobre tinta não existe. É a mesma regra do selo.
          */}
          <Link
            href={href('/marcar')}
            className={cn(buttonVariants({ variant: 'on-ink', size: 'sm' }), 'px-4')}
          >
            Marcar
          </Link>
        </div>
      </div>
    </header>
  )
}

function ItemBarra({
  hrefTo,
  atual,
  children,
}: {
  hrefTo: string
  atual?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href(hrefTo)}
      aria-current={atual ? 'page' : undefined}
      className={cn(
        'rounded-plate relative flex min-h-11 items-center px-2.5 text-sm whitespace-nowrap transition-colors sm:px-3',
        atual ? 'text-(--on-ink)' : 'text-(--on-ink-muted) hover:text-(--on-ink)',
      )}
    >
      {children}
      {/* A régua de bronze marca o trecho activo — a mesma assinatura gráfica
          que fecha um bloco no resto do sistema. */}
      {atual ? (
        <span aria-hidden className="absolute inset-x-2.5 bottom-1.5 h-px bg-(--on-ink-accent)" />
      ) : null}
    </Link>
  )
}
