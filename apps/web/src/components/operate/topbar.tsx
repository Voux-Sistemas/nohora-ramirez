import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { NavOperacao, type DestinoOperacao } from '@/components/operate/nav'
import { SeletorTema } from '@/components/tema/seletor-tema'
import { sair } from '@/server/auth/actions'
import { unidadesVisiveis, type Acesso } from '@/server/auth/permissoes'
import { listUnits } from '@/server/scheduling/context'
import { cn, href } from '@/lib/utils'

/**
 * A barra da oficina.
 *
 * O contrato de direção diz que vitrine e oficina são a mesma marca em duas
 * temperaturas — então a recepção abre o dia debaixo da mesma faixa de tinta que
 * a cliente vê no celular, com o mesmo monograma. O que muda é a densidade: aqui
 * a faixa também carrega a navegação, porque quem está de pé no tablet troca de
 * agenda para caixa dezenas de vezes por turno e não pode voltar ao início para
 * isso — e carrega a loja em que se está, que é a outra metade da pergunta
 * "onde estou".
 *
 * A marca do trecho ativo é a régua de bronze — a mesma assinatura gráfica que
 * fecha um bloco no resto do sistema. Não é sublinhado de link nem pílula: é o
 * fio da coroa, aparecendo no único lugar da barra que precisa de ênfase.
 *
 * A barra é o rosto da permissão. Um destino que a pessoa não pode abrir não
 * aparece aqui — esconder é cortesia, não segurança: o porteiro de verdade está
 * em cada tela. Mas uma barra que oferece o que vai dar em redirecionamento é
 * uma barra que mente, e quem trabalha nela aprende a desconfiar dos cinco
 * botões por causa de um. Vale igual para a lista de lojas do seletor: sai de
 * `unidadesVisiveis`, e não de `listUnits`, senão a barra anuncia ao gerente do
 * Centro que existe um Valongo.
 */

export type SecaoOperacao = 'hoje' | 'agenda' | 'avisos' | 'caixa' | 'clientes' | 'cadastros'

/**
 * O que cada degrau vê na barra — e a barra é só o dia.
 *
 * A profissional tem um destino só, e ele leva o nome do que é: a agenda dela.
 *
 * "Gestão" saiu daqui. Não porque estorve, mas porque não é da mesma família:
 * Hoje, Agenda, Avisos, Caixa e Clientes são o turno — a dona toca-lhes dezenas
 * de vezes por dia —, e cadastrar um serviço ou mudar uma comissão é coisa que
 * se faz uma vez por mês, sentada. Lado a lado, os seis pareciam seis escolhas
 * do mesmo peso, e era metade da queixa de "opção a mais". Gestão mudou-se para
 * o lado direito, junto do nome e do sair, que é onde todo o produto guarda o
 * que se ajusta em vez do que se usa.
 *
 * `comLoja` marca as secções que existem uma vez por loja. É o que faz a loja
 * seguir a pessoa: de `/agenda/valongo` para `/caixa/valongo`, sem passar por
 * uma tela a perguntar qual.
 */
function destinosDe(acesso: Acesso): DestinoOperacao[] {
  if (acesso.papel === 'profissional') {
    return [{ id: 'agenda', path: '/agenda', label: 'A minha agenda', comLoja: true }]
  }

  return [
    { id: 'hoje', path: '/', label: 'Hoje' },
    { id: 'agenda', path: '/agenda', label: 'Agenda', comLoja: true },
    { id: 'avisos', path: '/avisos', label: 'Avisos', comLoja: true },
    { id: 'caixa', path: '/caixa', label: 'Caixa', comLoja: true },
    { id: 'clientes', path: '/clientes', label: 'Clientes' },
  ]
}

export async function OperateTopbar({
  acesso,
  active,
}: {
  acesso: Acesso
  active?: SecaoOperacao
}) {
  const destinos = destinosDe(acesso)
  const lojas = unidadesVisiveis(acesso, await listUnits()).map((unidade) => ({
    slug: unidade.slug,
    name: unidade.name,
  }))

  return (
    /*
      `--focus` global é tinta, que sobre esta faixa seria um anel invisível.
      Redefinir o token no elemento é o conserto certo: quem está dentro herda
      o bronze sem que nenhum filho precise saber que está sobre tinta.
    */
    <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      {/* A mesma moldura de 90rem da gestão: a barra é a chapa de cima da
          aplicação, e uma chapa mais estreita do que o conteúdo que segura
          denuncia que a tela foi desenhada para outro ecrã.

          Duas filas no telemóvel, uma a partir de `sm`. Numa fila só, o
          logótipo e o bloco da pessoa somam 455px de coisas que não encolhem —
          num iPhone de 390px isso não é uma barra apertada, é uma barra que
          transborda, com metade do "sair" fora do ecrã e o nome da secção ativa
          por baixo do relógio. As `order` fazem a segunda fila ser a navegação
          (que é `w-full` até `sm`), e não o bloco da pessoa: quem chega à barra
          quer ver primeiro a casa e quem é, e depois para onde vai. */}
      <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-x-3 gap-y-0 px-4 sm:flex-nowrap sm:gap-x-4 sm:px-6 lg:px-8">
        {/*
          O mesmo logotipo da vitrine, no mesmo tamanho, sobre a mesma faixa de
          tinta: é o que faz a oficina e a tela da cliente serem a mesma casa.
          Aqui não entra o monograma — a coroa botânica tem folha de traço 1 e a
          32px de altura vira uma mancha; o selo é para tamanho grande, e o
          logotipo é o que aguenta ser pequeno.
        */}
        <Link
          href={href(destinos[0]!.path)}
          className="rounded-plate order-1 shrink-0 py-2 sm:py-3"
          aria-label="Nohora Ramirez — início"
        >
          <Wordmark size="sm" align="left" />
        </Link>

        <NavOperacao destinos={destinos} lojas={lojas} active={active} />

        {/* `ml-auto` para a fila do telemóvel, onde este bloco não tem a
            navegação a empurrá-lo: sem isso encostava ao logótipo e a barra
            ficava com um vazio à direita. */}
        <div className="order-2 ml-auto flex shrink-0 items-center gap-2 text-sm sm:order-3 sm:gap-3">
          {/* Gestão vive deste lado, e o fio separa-a do que é a pessoa: à
              esquerda do fio está para onde se vai, à direita quem está a ir. */}
          {acesso.papel !== 'profissional' ? (
            <>
              <Link
                href={href('/admin')}
                aria-current={active === 'cadastros' ? 'page' : undefined}
                className={cn(
                  'rounded-plate relative flex min-h-11 items-center px-1 whitespace-nowrap transition-colors',
                  active === 'cadastros'
                    ? 'font-medium text-(--on-ink)'
                    : 'text-(--on-ink-muted) hover:text-(--on-ink)',
                )}
              >
                Gestão
                {active === 'cadastros' ? (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-(--on-ink-accent)" />
                ) : null}
              </Link>
              <span aria-hidden className="h-5 w-px shrink-0 bg-(--border-on-ink)" />
            </>
          ) : null}

          <span className="text-(--on-ink-muted) hidden max-w-40 truncate md:inline">
            {acesso.session.name}
          </span>
          <SeletorTema />
          <form action={sair}>
            {/* Sair aqui é quase sempre trocar de pessoa no mesmo balcão: cai
                na porta, não na montra. */}
            <input type="hidden" name="para" value="/entrar" />
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
