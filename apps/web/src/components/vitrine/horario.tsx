import { interpola, type Dicionario } from '@/i18n'
import { cn } from '@/lib/utils'
import type { DiaDaSemana } from '@/server/vitrine'

/**
 * A semana como o salão a escreveria num vidro.
 *
 * Sete linhas iguais é o que um banco de dados devolve, não o que uma casa
 * afixa na porta. Dias seguidos com o mesmo horário viram uma linha só —
 * "Segunda a sexta 09:00–19:00" — porque é assim que se lê de relance, e porque
 * a exceção (o sábado que fecha mais cedo, a segunda de folga) só salta aos
 * olhos quando não está enterrada entre seis linhas idênticas.
 *
 * A semana começa à segunda: é a semana portuguesa, não a do índice 0 do
 * `Date`.
 *
 * Hoje leva ponto de bronze e não negrito sozinho: numa lista de quatro linhas,
 * o peso da letra por si só é a diferença que ninguém vê de relance. O ponto
 * ocupa lugar fixo em todas as linhas, para que marcar o dia não desalinhe a
 * coluna dos nomes — a lista continua a ler-se como coluna, com uma linha
 * assinalada, e não como uma linha empurrada para fora das outras.
 *
 * Os nomes dos dias e as junções ("e", "a") entram por propriedade: a montra
 * fala três línguas e o agrupamento é o mesmo nas três. O que muda é a
 * palavra, não a regra — por isso `ORDEM` e `agrupar` ficam aqui e o
 * dicionário só empresta o vocabulário.
 */

const ORDEM = [1, 2, 3, 4, 5, 6, 0] as const

export function Semana({
  semana,
  hoje,
  dias,
  gram,
  encerrado,
  className,
}: {
  semana: readonly DiaDaSemana[]
  /** Índice do dia de hoje no fuso da loja, para o destacar. */
  hoje?: number
  dias: Dicionario['dias']['longos']
  gram: Dicionario['gramatica']
  encerrado: string
  className?: string
}) {
  if (semana.length === 0) return null

  const faixas = agrupar(semana)

  return (
    <dl className={cn('space-y-2.5', className)}>
      {faixas.map((faixa) => {
        const atual = hoje !== undefined && faixa.dias.includes(hoje)
        return (
          <div key={faixa.dias.join('-')} className="flex items-baseline justify-between gap-4">
            <dt
              className={cn(
                'flex items-baseline gap-2.5 text-[0.9375rem]',
                atual ? 'font-medium text-(--text-strong)' : 'text-muted',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-1.5 shrink-0 translate-y-[-0.15em] rounded-full',
                  atual ? 'bg-(--accent)' : 'bg-transparent',
                )}
              />
              {rotulo(faixa.dias, dias, gram)}
            </dt>
            <dd
              className={cn(
                'tnum text-right text-[0.9375rem] whitespace-nowrap',
                atual ? 'font-medium text-(--text-strong)' : 'text-body',
              )}
            >
              {faixa.janelas.length === 0
                ? encerrado
                : faixa.janelas.map((j) => `${j.abre}–${j.fecha}`).join(' · ')}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

interface Faixa {
  dias: number[]
  janelas: { abre: string; fecha: string }[]
}

function agrupar(semana: readonly DiaDaSemana[]): Faixa[] {
  const porDia = new Map(semana.map((d) => [d.weekday, d.janelas]))
  const faixas: Faixa[] = []

  for (const weekday of ORDEM) {
    const janelas = porDia.get(weekday) ?? []
    const ultima = faixas[faixas.length - 1]
    if (ultima && assinatura(ultima.janelas) === assinatura(janelas)) {
      ultima.dias.push(weekday)
    } else {
      faixas.push({ dias: [weekday], janelas })
    }
  }

  return faixas
}

const assinatura = (janelas: { abre: string; fecha: string }[]) =>
  janelas.map((j) => `${j.abre}-${j.fecha}`).join('|')

/*
  "Segunda a sexta" quando são três ou mais dias seguidos; "Segunda e terça"
  quando são dois. Escrever "Segunda a terça" para dois dias soa a intervalo de
  formulário — ninguém fala assim.
*/
function rotulo(faixa: number[], dias: Dicionario['dias']['longos'], gram: Dicionario['gramatica']): string {
  const nomes = faixa.map((d) => dias[d]!)
  if (nomes.length === 1) return nomes[0]!
  const molde = nomes.length === 2 ? gram.par : gram.intervalo
  return interpola(molde, { a: nomes[0]!, b: nomes[nomes.length - 1]! })
}
