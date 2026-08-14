import { Photo } from '@/components/ui/photo'
import { formatPhone } from '@/lib/format'
import type { UnitInfo } from '@/server/scheduling/context'

/**
 * Âncora do rail nos passos 2 e 3: a casa continua visível enquanto a
 * cliente decide o quê e o quando. No celular ele fecha a coluna depois da
 * escolha — apoio, não decisão; a partir de `lg` fica fixo ao lado.
 */
export function UnitContextCard({ unit }: { unit: UnitInfo }) {
  return (
    <div className="plate overflow-hidden">
      <div className="relative">
        <Photo
          src={unit.imageUrl}
          alt=""
          name={unit.name}
          sizes="22rem"
          className="aspect-[4/3]"
        />
        <div className="scrim-photo pointer-events-none absolute inset-0" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="display text-[1.375rem] leading-tight text-(--on-ink)">
            {unit.name}
          </p>
        </div>
      </div>

      {unit.addressLine || unit.phone ? (
        <div className="space-y-1 p-4 text-sm">
          {unit.addressLine ? (
            <p className="text-body">
              {unit.addressLine}
              {unit.district ? ` · ${unit.district}` : ''}
            </p>
          ) : null}
          {unit.phone ? <p className="tnum text-muted">{formatPhone(unit.phone)}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
