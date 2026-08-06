import Link from 'next/link'
import { BookingShell } from '@/components/booking/shell'
import { Photo } from '@/components/ui/photo'
import { formatPhone } from '@/lib/format'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Agendar' }

/**
 * Primeiro passo: onde.
 *
 * A escolha é de um lugar, então o lugar aparece. Endereço em lista de texto faz
 * a cliente escolher pela rua que ela reconhece; a foto faz escolher pela sala
 * em que ela vai passar duas horas. As três unidades têm o mesmo peso na grade —
 * nenhuma é "a principal", e sugerir isso seria inventar uma hierarquia que o
 * salão não declarou.
 */
export default async function EscolherUnidadePage() {
  const units = await listUnits()

  return (
    <BookingShell
      step={1}
      width="wide"
      title="Onde você quer ser atendida?"
      subtitle="Cada casa tem a sua equipe e a sua agenda. Escolha a que fica mais perto de onde você vai estar."
    >
      <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {units.map((unit, index) => (
          <li key={unit.id}>
            <Link href={`/agendar/${unit.slug}` as never} className="group block rounded-plate">
              <Photo
                src={unit.imageUrl}
                alt={`Salão ${unit.name}`}
                name={unit.name}
                interactive
                priority={index === 0}
                sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 90vw"
                /*
                  Retrato só quando há vizinho ao lado. Empilhados no celular,
                  três 4:5 de largura inteira davam uma página de seis mil
                  pixels para uma escolha de três itens — rolar não é escolher.
                */
                className="aspect-[4/3] rounded-plate sm:aspect-[4/5]"
              />

              {/*
                `min-h` de duas linhas a partir de `sm`, onde os cartões ficam
                lado a lado: "Nohora Ramirez Centro" cabe em uma linha e
                "Nohora Ramirez Jardins" quebra em duas, e sem o piso a régua de
                bronze e o endereço param em alturas diferentes. Em coluna única
                não há com quem alinhar, e o piso só reservaria linha vazia.
              */}
              <h2 className="display mt-5 text-[1.75rem] leading-[1.06] text-balance transition-colors group-hover:text-(--accent-ink) sm:min-h-[2.12em]">
                {unit.name}
              </h2>
              <div className="rule-bronze mt-3 w-10" aria-hidden />

              {unit.addressLine ? (
                <p className="text-body mt-3 text-sm">
                  {unit.addressLine}
                  {unit.district ? <span className="text-muted"> · {unit.district}</span> : null}
                </p>
              ) : null}
              {unit.phone ? (
                <p className="text-muted tnum mt-1 text-sm">{formatPhone(unit.phone)}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </BookingShell>
  )
}
