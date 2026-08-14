import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { SeletorTema } from '@/components/tema/seletor-tema'
import { sair } from '@/server/auth/actions'
import type { Acesso } from '@/server/auth/permissoes'
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
 *
 * A barra é o rosto da permissão. Um destino que a pessoa não pode abrir não
 * aparece aqui — esconder é cortesia, não segurança: o porteiro de verdade está
 * em cada tela. Mas uma barra que oferece o que vai dar em redirecionamento é
 * uma barra que mente, e quem trabalha nela aprende a desconfiar dos seis
 * botões por causa de um.
 */

export type SecaoOperacao = 'hoje' | 'agenda' | 'avisos' | 'caixa' | 'clientes' | 'cadastros'

interface Secao {
  id: SecaoOperacao
  path: string
  label: string
}

/**
 * O que cada degrau vê na barra.
 *
 * A profissional tem um destino só, e ele leva o nome do que é: a agenda dela.
 * "Gestão" sempre abre no Painel — o mês em números, com variação contra o mês
 * anterior — porque é a primeira coisa que quem gere quer ver, antes de mexer
 * em unidade, equipe ou catálogo. A navegação lateral de dentro leva ao resto.
 */
function secoesDe(acesso: Acesso): Secao[] {
  if (acesso.papel === 'profissional') {
    return [{ id: 'agenda', path: '/agenda', label: 'A minha agenda' }]
  }

  return [
    { id: 'hoje', path: '/', label: 'Hoje' },
    { id: 'agenda', path: '/agenda', label: 'Agenda' },
    { id: 'avisos', path: '/avisos', label: 'Avisos' },
    { id: 'caixa', path: '/caixa', label: 'Caixa' },
    { id: 'clientes', path: '/clientes', label: 'Clientes' },
    { id: 'cadastros', path: '/admin', label: 'Gestão' },
  ]
}

export function OperateTopbar({
  acesso,
  active,
}: {
  acesso: Acesso
  active?: SecaoOperacao
}) {
  const secoes = secoesDe(acesso)

  return (
    /*
      `--focus` global é tinta, que sobre esta faixa seria um anel invisível.
      Redefinir o token no elemento é o conserto certo: quem está dentro herda
      o bronze sem que nenhum filho precise saber que está sobre tinta.
    */
    <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      {/* A mesma moldura de 90rem da gestão: a barra é a chapa de cima da
          aplicação, e uma chapa mais estreita do que o conteúdo que segura
          denuncia que a tela foi desenhada para outro ecrã. */}
      <div className="mx-auto flex w-full max-w-[90rem] items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/*
          O mesmo logotipo da vitrine, no mesmo tamanho, sobre a mesma faixa de
          tinta: é o que faz a oficina e a tela da cliente serem a mesma casa.
          Aqui não entra o monograma — a coroa botânica tem folha de traço 1 e a
          32px de altura vira uma mancha; o selo é para tamanho grande, e o
          logotipo é o que aguenta ser pequeno.
        */}
        <Link
          href={href(secoes[0]!.path)}
          className="rounded-plate shrink-0 py-3"
          aria-label="Nohora Ramirez — início"
        >
          <Wordmark size="sm" align="left" />
        </Link>

        {/*
          Rolagem horizontal em vez de menu escondido: são no máximo seis
          destinos fixos e curtos. Esconder atrás de um botão custaria um toque a
          cada troca, que é a ação mais repetida do turno.
        */}
        <nav
          aria-label="Secções"
          className="-mb-px flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto"
        >
          {secoes.map((secao) => {
            const atual = active === secao.id
            return (
              <Link
                key={secao.id}
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
            {acesso.session.name}
          </span>
          <SeletorTema />
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
