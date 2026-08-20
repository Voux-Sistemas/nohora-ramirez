import Link from 'next/link'
import { Wreath } from '@/components/brand/mark'
import { buttonVariants } from '@/components/ui/button'
import { dicionario, interpola } from '@/i18n'
import type { Idioma } from '@/i18n/tipos'
import { cn, href } from '@/lib/utils'
import { loginClienteDisponivel } from '@/server/auth/otp'
import { listUnits } from '@/server/scheduling/context'
import { rede } from '@/server/vitrine'

/**
 * O fecho do lado da rua: onde estão as casas, e onde entra quem cá trabalha.
 *
 * O bloco de tinta acima deste é a porta — "Marcar", em letras grandes. Este é
 * o rodapé de verdade, e o seu trabalho é o oposto: não convencer ninguém, só
 * responder ao que sobra. Onde é a outra casa. Onde vejo a marcação que já fiz.
 * Onde é que a equipa entra.
 *
 * A porta da equipa vive aqui, e não num botão no topo, porque é a única frase
 * desta página escrita para quem não é cliente. Uma cliente que a leia percebe
 * que não é para ela; uma funcionária que a procure encontra-a onde toda a gente
 * põe este tipo de coisa. Escondê-la de vez obrigaria a decorar `/entrar`, que
 * foi exactamente a queixa da reunião — o sistema tem de ser navegável por si.
 *
 * ── Duas coisas mudaram, e ambas por causa de onde ele é usado ──
 *
 * **É de tinta.** Era uma tira de travertino com um fio por cima, e lia-se como
 * o que sobrou da página. A montra abre em tinta; fechar na mesma cor faz da
 * página uma peça entre dois extremos em vez de uma coisa que acaba a cair.
 *
 * **A coluna das casas depende de `atual`.** Ela existia para responder "onde é
 * a outra casa", e essa pergunta só se faz de dentro de uma casa. Em `/loja` a
 * página *é* a lista das casas — elas estão nos separadores do cabeçalho e em
 * duas bandas do tamanho de uma sala — e a coluna era o terceiro sítio a dizer
 * o mesmo. Sem `atual`, não se desenha.
 */
export async function RodapePublico({
  idioma,
  atual,
  className,
}: {
  /** A língua em vigor. Não leva selector: o do cabeçalho chega e sobra. */
  idioma: Idioma
  /** Slug da casa aberta. Ausente na montra da rede — ver acima. */
  atual?: string
  className?: string
}) {
  const [lojas, marca] = await Promise.all([listUnits(), rede()])
  const dic = dicionario(idioma)
  const ano = new Date().getFullYear()

  /* Só as outras. Oferecer a casa em que se está como se fosse outro sítio é
     mandar a pessoa para onde ela já está. */
  const outras = atual ? lojas.filter((loja) => loja.slug !== atual) : []

  return (
    <footer
      className={cn(
        'relative overflow-hidden bg-(--surface-ink) text-(--on-ink-muted)',
        /* Sobre tinta, quem age é a pedra clara e o foco é bronze — sem isto os
           filhos herdariam os tokens da página, que aqui não se leem. */
        '[--focus:var(--on-ink-accent)]',
        className,
      )}
    >
      {/* A coroa a assomar pelo canto, cortada. É assinatura, e uma assinatura
          fica no fim — não é a mesma peça que abre a página. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 aspect-square w-[18rem] -translate-x-[38%] translate-y-[40%] text-(--on-ink-accent) opacity-[0.1] sm:w-[26rem]"
      >
        <Wreath />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end gap-x-12 gap-y-8">
          <div>
            <p className="display text-[clamp(1.5rem,3vw,1.9rem)] tracking-[0.16em] text-(--on-ink)">
              {marca?.nome ?? 'NOHORA RAMIREZ'}
            </p>
            {outras.length > 0 ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.9375rem]">
                {outras.map((loja) => (
                  <Link
                    key={loja.id}
                    href={href(`/loja/${loja.slug}`)}
                    className="transition-colors hover:text-(--on-ink)"
                  >
                    {loja.name}
                    {/* As duas casas chamam-se pelo nome da terra onde estão, e o
                        rodapé escrevia "Maia · Maia". A cidade só acrescenta
                        alguma coisa quando diz outra coisa que o nome. */}
                    {loja.city && loja.city !== loja.name ? ` · ${loja.city}` : ''}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>

          {/*
            Dois botões, e dois pesos. Eram texto esbatido numa fila, do mesmo
            tamanho e da mesma cor que o aviso de direitos ao lado — ninguém os
            lia como coisas em que se clica. Marcar é o que se quer que aconteça;
            a área da equipa só tem de ser encontrável.
          */}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Link
              /* Dentro da montra de uma casa, marcar é marcar NELA — mandar para
                 o selector de loja é fazer a pergunta que a pessoa já respondeu
                 ao entrar aqui. Sem casa aberta, o selector é a resposta certa. */
              href={href(atual ? `/agendar/${atual}` : '/agendar')}
              className={buttonVariants({ variant: 'on-ink', size: 'md' })}
            >
              {dic.chrome.marcarOnline}
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={href('/entrar')}
              className={buttonVariants({ variant: 'on-ink-outline', size: 'md' })}
            >
              {dic.chrome.areaDaEquipa}
            </Link>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-(--border-on-ink) pt-6 text-[0.8125rem] sm:mt-16">
          {marca?.instagram ? (
            <a
              href={`https://instagram.com/${marca.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-(--on-ink)"
            >
              @{marca.instagram}
            </a>
          ) : null}

          {/* A mesma regra de `/conta/entrar`: sem por onde mandar o código, a
              porta não abre, e um link que não abre é pior do que nenhum. */}
          {loginClienteDisponivel() ? (
            <Link href={href('/conta')} className="transition-colors hover:text-(--on-ink)">
              {dic.chrome.asSuasMarcacoes}
            </Link>
          ) : null}

          <p className="ml-auto">
            {interpola(dic.chrome.direitos, { ano, marca: marca?.nome ?? 'Nohora Ramirez' })}
          </p>
        </div>
      </div>
    </footer>
  )
}
