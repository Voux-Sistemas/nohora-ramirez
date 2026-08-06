import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { sair } from '@/server/auth/actions'
import type { SessionUser } from '@/server/auth/session'
import { cn, href } from '@/lib/utils'

/**
 * A barra da oficina.
 *
 * O contrato de direção diz que vitrine e oficina são a mesma marca em duas
 * temperaturas — então a recepção abre o dia debaixo da mesma faixa de tinta que
 * a cliente vê no celular, com o mesmo monograma. O que muda é a densidade: aqui
 * a faixa também carrega a navegação, porque quem está de pé no tablet troca de
 * agenda para caixa dezenas de vezes por turno e não pode voltar ao início para
 * isso.
 *
 * A marca do trecho ativo é a régua de bronze — a mesma assinatura gráfica que
 * fecha um bloco no resto do sistema. Não é sublinhado de link nem pílula: é o
 * fio da coroa, aparecendo no único lugar da barra que precisa de ênfase.
 */

const SECOES = [
  { path: '/', label: 'Hoje' },
  { path: '/agenda', label: 'Agenda' },
  { path: '/avisos', label: 'Avisos' },
  { path: '/caixa', label: 'Caixa' },
  { path: '/clientes', label: 'Clientes' },
  { path: '/admin/unidades', label: 'Cadastros' },
] as const

export type SecaoOperacao = (typeof SECOES)[number]['path']

export function OperateTopbar({
  session,
  active,
}: {
  session: SessionUser
  active?: SecaoOperacao
}) {
  return (
    /*
      `--focus` global é tinta, que sobre esta faixa seria um anel invisível.
      Redefinir o token no elemento é o conserto certo: quem está dentro herda
      o bronze sem que nenhum filho precise saber que está sobre tinta.
    */
    <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/*
          O mesmo logotipo da vitrine, no mesmo tamanho, sobre a mesma faixa de
          tinta: é o que faz a oficina e a tela da cliente serem a mesma casa.
          Aqui não entra o monograma — a coroa botânica tem folha de traço 1 e a
          32px de altura vira uma mancha; o selo é para tamanho grande, e o
          logotipo é o que aguenta ser pequeno.
        */}
        <Link href="/" className="rounded-plate shrink-0 py-3" aria-label="Nohora Ramirez — início">
          <Wordmark size="sm" align="left" />
        </Link>

        {/*
          Rolagem horizontal em vez de menu escondido: são seis destinos fixos e
          curtos. Esconder atrás de um botão custaria um toque a cada troca, que
          é a ação mais repetida do turno.
        */}
        <nav
          aria-label="Seções"
          className="-mb-px flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto"
        >
          {SECOES.map((secao) => {
            const atual = active === secao.path
            return (
              <Link
                key={secao.path}
                href={href(secao.path)}
                aria-current={atual ? 'page' : undefined}
                className={cn(
                  'rounded-plate relative flex shrink-0 items-center px-3 text-sm whitespace-nowrap transition-colors',
                  // alvo de 44px de pé, com luz de salão e a mão ocupada
                  'min-h-11',
                  atual
                    ? 'font-medium text-(--on-ink)'
                    : 'text-(--on-ink-muted) hover:text-(--on-ink)',
                )}
              >
                {secao.label}
                {atual ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 bottom-0 h-px bg-(--on-ink-accent)"
                  />
                ) : null}
              </Link>
            )
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="text-(--on-ink-muted) hidden max-w-40 truncate md:inline">
            {session.name}
          </span>
          <form action={sair}>
            <button
              type="submit"
              className="rounded-plate text-(--on-ink-muted) hover:text-(--on-ink) min-h-11 px-1 transition-colors"
            >
              sair
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
