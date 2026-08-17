import { FaixaDaMarca } from '@/components/brand/faixa'

/**
 * Casca das telas de porta: entrar, recuperar a palavra-passe, código de acesso
 * da cliente, primeira conta da instalação.
 *
 * Havia oito cópias de uma linha só — `min-h-[80vh] … justify-center` — e o que
 * ela fazia era pôr uma coluna de 384px a flutuar no meio do ecrã, com vazio por
 * cima e vazio por baixo. No telemóvel empurra o formulário para o meio e afasta
 * o polegar dos campos; no computador é um cartão pequeno sozinho no meio da
 * largura toda. Era o espaço em branco mais visível do produto.
 *
 * O `vh` era o erro por baixo do erro: no Safari de telemóvel `vh` mede o ecrã
 * com a barra de endereço recolhida, portanto `80vh` é mais alto do que o que se
 * vê — a tela rolava sem ter nada que rolasse.
 *
 * Agora a coluna tem topo. A faixa de tinta é a mesma placa de porta do fluxo de
 * marcação: a mesma marca em duas temperaturas, e é ela que ancora o formulário
 * em vez de o centrar no vazio.
 */
export function Porta({
  title,
  subtitle,
  children,
  footer,
  home = '/loja',
}: {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  /** Saída secundária: "esqueci-me", "voltar a marcar". Fecha a coluna. */
  footer?: React.ReactNode
  /** Para onde vai a marca. A montra por omissão — é a cara pública do salão. */
  home?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <FaixaDaMarca largura="max-w-md" home={home} />

      {/*
        `pt-12` e não centrado: a tela de porta é curta por natureza, e uma tela
        curta acaba onde o conteúdo acaba. O espaço que sobra fica em baixo, que
        é onde não incomoda — no telemóvel mantém os campos no terço de cima,
        ao alcance do polegar, e é lá que o teclado os quer quando sobe.
      */}
      <main className="mx-auto w-full max-w-md flex-1 px-5 pt-12 pb-16 sm:px-8 sm:pt-16">
        <h1 className="display display-md">{title}</h1>
        {subtitle ? <p className="text-body mt-3 text-[0.9375rem]">{subtitle}</p> : null}

        <div className="mt-8">{children}</div>

        {footer ? (
          <div className="text-muted mt-8 border-t border-(--border-subtle) pt-6 text-sm">
            {footer}
          </div>
        ) : null}
      </main>
    </div>
  )
}

/**
 * O código de acesso escrito na própria tela, em modo de teste.
 *
 * Vive aqui, e não copiado nas duas telas que o mostram, porque é o aviso mais
 * perigoso do produto: se um dia aparecer em produção, mostra a estranhos o
 * código que abre a conta de outra pessoa. Um sítio só é um sítio só para
 * auditar. Quem decide se ele aparece continua a ser o servidor — a tela só
 * recebe o código já resolvido, ou não recebe nada.
 *
 * A cor é o token de aviso da casa, e não uma paleta emprestada com `dark:`.
 * O tema aqui é `<html data-theme>` decidido no servidor, não a preferência do
 * sistema operativo — o `dark:` do Tailwind escuta a segunda e nunca a
 * primeira, portanto aquelas classes ou não faziam nada, ou (pior) escureciam
 * este aviso no meio de uma página clara. `--estado-aviso` existe nos dois
 * temas e é o mesmo âmbar que marca a falta na agenda.
 */
export function CodigoDeTeste({ codigo }: { codigo: string | undefined }) {
  if (!codigo) return null
  return (
    <p className="rounded-plate mb-4 border border-(--estado-aviso)/40 bg-(--estado-aviso)/10 p-3 text-sm">
      <span className="font-medium text-(--estado-aviso)">Modo desenvolvimento</span> — código:{' '}
      <span className="font-mono font-semibold">{codigo}</span>
    </p>
  )
}
