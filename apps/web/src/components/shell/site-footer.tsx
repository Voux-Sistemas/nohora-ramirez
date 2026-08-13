import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import type { UnitInfo } from '@/server/scheduling/context'
import { rede } from '@/server/vitrine'

/**
 * O pé da vitrine.
 *
 * Carrega o que a cliente procura quando já decidiu: a morada de cada casa e o
 * telefone. Não é mapa do site — as quatro rotas da cliente já estão na barra
 * de cima, repeti-las aqui seria o rodapé de colunas que todo gerador desenha.
 */
export async function SiteFooter({ unidades }: { unidades: readonly UnitInfo[] }) {
  const org = await rede()

  return (
    <footer className="mt-20 bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between sm:gap-16">
          <div className="shrink-0">
            <Wordmark size="md" align="left" />
            {org?.instagram ? (
              <a
                href={`https://instagram.com/${org.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-block text-sm text-(--on-ink-muted) underline-offset-4 transition-colors hover:text-(--on-ink) hover:underline"
              >
                @{org.instagram}
              </a>
            ) : null}
          </div>

          {/* Uma coluna por casa: a morada é o que se copia para o mapa. */}
          <div className="grid gap-8 sm:grid-cols-2 sm:gap-14">
            {unidades.map((unidade) => (
              <div key={unidade.id} className="min-w-0">
                <Link
                  href={href(`/casa/${unidade.slug}`)}
                  className="rounded-plate font-medium underline-offset-4 hover:underline"
                >
                  {unidade.name}
                </Link>
                <address className="mt-2 space-y-0.5 text-sm not-italic text-(--on-ink-muted)">
                  {unidade.addressLine ? <p>{unidade.addressLine}</p> : null}
                  {unidade.postalCode || unidade.city ? (
                    <p>{[unidade.postalCode, unidade.city].filter(Boolean).join(' ')}</p>
                  ) : null}
                  {unidade.phone ? (
                    <p className="tnum pt-1">
                      <a href={`tel:${unidade.phone}`} className="hover:text-(--on-ink)">
                        {formatPhone(unidade.phone)}
                      </a>
                    </p>
                  ) : null}
                </address>
              </div>
            ))}
          </div>
        </div>

        <div className="rule-bronze-on-ink mt-12 w-full opacity-50" />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-(--on-ink-muted)">
          <p>© {new Date().getFullYear()} {org?.nome ?? 'Nohora Ramirez'}</p>
          {/* A porta da equipa mora aqui, discreta: quem trabalha na casa sabe
              onde é, e a cliente não precisa de a ver no topo. */}
          <Link href={href('/painel')} className="rounded-plate hover:text-(--on-ink)">
            Área da equipa
          </Link>
        </div>
      </div>
    </footer>
  )
}
