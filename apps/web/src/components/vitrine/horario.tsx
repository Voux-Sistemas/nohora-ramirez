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
 */

const ORDEM = [1, 2, 3, 4, 5, 6, 0] as const

const NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

export function Semana({
  semana,
  hoje,
  className,
}: {
  semana: readonly DiaDaSemana[]
  /** Índice do dia de hoje no fuso da loja, para o destacar. */
  hoje?: number
  className?: string
}) {
  if (semana.length === 0) return null

  const faixas = agrupar(semana)

  return (
    <dl className={cn('mt-3 space-y-1.5', className)}>
      {faixas.map((faixa) => {
        const atual = hoje !== undefined && faixa.dias.includes(hoje)
        return (
          <div key={faixa.dias.join('-')} className="flex items-baseline justify-between gap-4">
            <dt className={cn('text-[0.875rem]', atual ? 'text-(--text-strong)' : 'text-muted')}>
              {rotulo(faixa.dias)}
            </dt>
            <dd
              className={cn(
                'tnum text-right text-[0.875rem] whitespace-nowrap',
                atual ? 'text-(--text-strong)' : 'text-body',
              )}
            >
              {faixa.janelas.length === 0
                ? 'Encerrado'
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
function rotulo(dias: number[]): string {
  const nomes = dias.map((d) => NOME[d]!)
  if (nomes.length === 1) return nomes[0]!
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`
  return `${nomes[0]} a ${nomes[nomes.length - 1]}`
}
