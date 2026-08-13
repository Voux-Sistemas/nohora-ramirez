import { BookingShell } from '@/components/booking/shell'
import { UnitPanel } from '@/components/booking/unit-panel'
import { listUnits } from '@/server/scheduling/context'
import { portaDasUnidades } from '@/server/scheduling/hoje'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Marcar' }

/**
 * Primeiro passo: onde.
 *
 * A escolha é de um lugar, então o lugar aparece do tamanho de um lugar. Uma
 * lista de endereços faz escolher pela rua que se reconhece; a fotografia
 * grande faz escolher pela sala. As duas casas têm exatamente o mesmo peso —
 * nenhuma é "a principal", e sugerir isso inventaria uma hierarquia que o
 * salão não declarou.
 */
export default async function EscolherUnidadePage() {
  const units = await listUnits()
  const portas = await portaDasUnidades(units)

  return (
    <BookingShell
      step={1}
      width="wide"
      title="Em que casa a recebemos?"
      subtitle="Cada casa tem a sua equipa e a sua agenda. Escolha a que lhe fica mais à mão."
    >
      <ul className={colunas(units.length)}>
        {units.map((unit, index) => (
          <li key={unit.id}>
            <UnitPanel
              unit={unit}
              hoje={portas.get(unit.id)}
              href={`/agendar/${unit.slug}`}
              priority={index === 0}
              sizes={sizesPara(units.length)}
            />
          </li>
        ))}
      </ul>
    </BookingShell>
  )
}

/*
  A rede tem duas lojas, e duas fotografias lado a lado é um díptico: cada uma
  ocupa metade da parede e nenhuma pede desculpa pelo tamanho. Três viram um
  tríptico. A partir de quatro a peça encolhe até virar cartão — e aí esta tela
  precisa de outro desenho, não de mais uma coluna. O limite está escrito aqui
  de propósito, para quem abrir a quinta loja ler isto antes de reclamar.
*/
function colunas(total: number): string {
  const base = 'grid gap-5 sm:gap-6'
  if (total <= 1) return `${base} mx-auto max-w-2xl`
  if (total === 2) return `${base} sm:grid-cols-2`
  return `${base} sm:grid-cols-2 lg:grid-cols-3`
}

function sizesPara(total: number): string {
  if (total <= 1) return '(min-width: 672px) 672px, 100vw'
  if (total === 2) return '(min-width: 1024px) 496px, (min-width: 640px) 48vw, 100vw'
  return '(min-width: 1024px) 328px, (min-width: 640px) 48vw, 100vw'
}
