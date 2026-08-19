import Link from 'next/link'
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
 */
export async function RodapePublico({
  idioma,
  atual,
  className,
}: {
  /** A língua em vigor. Não leva selector: o do cabeçalho chega e sobra. */
  idioma: Idioma
  /** Slug da casa aberta, para não a oferecer como se fosse outro sítio. */
  atual?: string
  className?: string
}) {
  const [lojas, marca] = await Promise.all([listUnits(), rede()])
  const dic = dicionario(idioma)
  const ano = new Date().getFullYear()

  return (
    <footer className={cn('border-t border-(--border-subtle)', className)}>
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-3">
          <Coluna titulo={dic.chrome.asCasas}>
            {lojas.map((loja) => (
              <Link
                key={loja.id}
                href={href(`/loja/${loja.slug}`)}
                aria-current={loja.slug === atual ? 'page' : undefined}
                className={cn(
                  'transition-colors hover:text-(--text-strong)',
                  loja.slug === atual && 'text-(--text-strong)',
                )}
              >
                {loja.name}
                {/* As duas casas chamam-se pelo nome da terra onde estão, e o
                    rodapé escrevia "Maia · Maia". A cidade só acrescenta
                    alguma coisa quando diz outra coisa que o nome. */}
                {loja.city && loja.city !== loja.name ? (
                  <span className="text-muted"> · {loja.city}</span>
                ) : null}
              </Link>
            ))}
          </Coluna>

          <Coluna titulo={dic.chrome.marcacao}>
            {/* Dentro da montra de uma casa, marcar é marcar NELA — mandar para o
                selector de loja é fazer a pergunta que a pessoa já respondeu ao
                entrar aqui. Sem casa aberta (a montra da rede), o selector é a
                resposta certa. */}
            <Link
              href={href(atual ? `/agendar/${atual}` : '/agendar')}
              className="transition-colors hover:text-(--text-strong)"
            >
              {dic.chrome.marcarOnline}
            </Link>
            {/* A mesma regra de `/conta/entrar`: sem por onde mandar o código,
                a porta não abre, e um link que não abre é pior do que nenhum. */}
            {loginClienteDisponivel() ? (
              <Link href={href('/conta')} className="transition-colors hover:text-(--text-strong)">
                {dic.chrome.asSuasMarcacoes}
              </Link>
            ) : null}
          </Coluna>

          {marca?.instagram ? (
            <Coluna titulo={dic.chrome.instagram}>
              <a
                href={`https://instagram.com/${marca.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-(--text-strong)"
              >
                @{marca.instagram}
              </a>
            </Coluna>
          ) : null}
        </div>

        <div className="text-muted mt-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-(--border-subtle) pt-6 text-xs">
          <p>{interpola(dic.chrome.direitos, { ano, marca: marca?.nome ?? 'Nohora Ramirez' })}</p>
          <Link href={href('/entrar')} className="transition-colors hover:text-(--text-strong)">
            {dic.chrome.areaDaEquipa}
          </Link>
        </div>
      </div>
    </footer>
  )
}

function Coluna({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="label-caps text-muted">{titulo}</h2>
      <div className="text-body mt-3 flex flex-col items-start gap-2 text-[0.9375rem]">
        {children}
      </div>
    </div>
  )
}
