'use client'

import { Photo } from '@/components/ui/photo'
import type { CasaEscolhivel } from '@/lib/marcacao-tipos'
import { cn } from '@/lib/utils'

/**
 * Onde.
 *
 * A escolha é de um lugar, então o lugar aparece do tamanho de um lugar. Uma
 * lista de moradas faz escolher pela rua que se reconhece; a fotografia grande
 * faz escolher pela sala. As casas têm exactamente o mesmo peso — nenhuma é
 * "a principal", e sugerir isso inventaria uma hierarquia que o salão não
 * declarou.
 *
 * Botão e não ligação: aqui não se navega, escolhe-se — e a escolha fica na
 * mesma tela.
 */
export function EscolherCasa({
  casas,
  escolhida,
  aoEscolher,
}: {
  casas: readonly CasaEscolhivel[]
  escolhida: string | null
  aoEscolher: (casa: CasaEscolhivel) => void
}) {
  return (
    <section>
      <h1 className="display display-lg">Em que casa a recebemos?</h1>
      <p className="text-body measure mt-3 text-[1.0625rem]">
        Cada casa tem a sua equipa e a sua agenda. Escolha a que lhe fica mais à mão.
      </p>

      <ul className={cn('mt-9 grid gap-5 sm:gap-6', casas.length >= 2 && 'sm:grid-cols-2')}>
        {casas.map((casa, indice) => {
          const activa = escolhida === casa.slug
          return (
            <li key={casa.slug}>
              <button
                type="button"
                onClick={() => aoEscolher(casa)}
                aria-pressed={activa}
                className={cn(
                  'rounded-plate group relative block w-full overflow-hidden text-left transition-shadow',
                  /* Seleccionado é tinta em todo o sistema — não há um segundo
                     idioma de selecção. Aqui a tinta aparece como anel, porque
                     o interior da peça é fotografia. */
                  activa
                    ? 'ring-2 ring-(--surface-invert)'
                    : 'ring-1 ring-(--border-subtle) hover:ring-(--border-strong)',
                )}
              >
                <Photo
                  src={casa.imagemUrl}
                  alt={`Salão ${casa.nome}`}
                  name={casa.nome}
                  interactive
                  priority={indice === 0}
                  sizes="(min-width: 1024px) 420px, (min-width: 640px) 46vw, 100vw"
                  className="aspect-[16/11] w-full sm:aspect-[4/5]"
                />

                <div
                  className="scrim-photo pointer-events-none absolute inset-x-0 bottom-0 h-3/5"
                  aria-hidden
                />

                <div className="absolute inset-x-0 bottom-0 p-5 text-(--on-ink) sm:p-7">
                  {casa.frase ? (
                    <p
                      className={cn(
                        'flex items-center gap-2 text-[0.8125rem]',
                        casa.aberta ? 'text-(--on-ink)' : 'text-(--on-ink-muted)',
                      )}
                    >
                      {casa.aberta ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-(--on-ink-accent)" aria-hidden />
                      ) : null}
                      {casa.frase}
                    </p>
                  ) : null}

                  <h2 className="display mt-1.5 text-[2rem] leading-[1.02] sm:text-[2.375rem]">
                    {casa.nome}
                  </h2>

                  <div className="rule-bronze-on-ink mt-3.5 w-10 transition-[width] duration-700 ease-(--ease-out-quint) group-hover:w-16" />

                  {casa.morada ? (
                    <p className="mt-3.5 max-w-[34ch] text-[0.9375rem] leading-snug text-(--on-ink-muted)">
                      {casa.morada}
                    </p>
                  ) : null}
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
