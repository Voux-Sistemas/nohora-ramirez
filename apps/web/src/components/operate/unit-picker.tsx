import Link from 'next/link'
import { Photo } from '@/components/ui/photo'
import type { UnitInfo } from '@/server/scheduling/context'
import { href } from '@/lib/utils'

/**
 * "Escolha a unidade" — a bifurcação que abre a agenda e o caixa.
 *
 * Era a mesma tela escrita duas vezes: três placas iguais com o nome e uma
 * seta. Placa igual repetida é o desenho que o sistema faz sozinho, e aqui ela
 * também escondia o único jeito rápido de acertar a loja: a foto. Quem trabalha
 * na Moema reconhece a Moema pela sala, não pela palavra.
 *
 * É a mesma pauta da tela de hoje, na mesma ordem de leitura, para as três
 * telas da operação que listam unidade parecerem a mesma coisa — porque são.
 */
export function UnitPicker({
  units,
  base,
}: {
  units: readonly UnitInfo[]
  /** Prefixo da rota, ex. `/caixa`. */
  base: string
}) {
  return (
    <div className="mt-7 border-t border-(--border-strong)">
      {units.map((unit) => (
        <Link
          key={unit.id}
          href={href(`${base}/${unit.slug}`)}
          className="group -mx-2 flex items-center gap-4 border-b border-(--border-subtle) px-2 py-4 transition-colors hover:bg-(--surface-sunken) sm:gap-5"
        >
          <Photo
            src={unit.imageUrl}
            alt=""
            name={unit.name}
            sizes="64px"
            className="aspect-square w-12 shrink-0 sm:w-16"
            interactive
          />

          <div className="min-w-0 flex-1">
            <h2 className="truncate font-medium">{unit.name}</h2>
            <p className="text-muted truncate text-sm">
              {unit.district ?? unit.addressLine ?? '—'}
            </p>
          </div>

          <span
            aria-hidden
            className="text-muted group-hover:text-(--text-strong) transition-[color,transform] group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      ))}

      {units.length === 0 ? (
        <p className="text-muted border-b border-(--border-subtle) px-1 py-8 text-sm">
          Nenhuma unidade ativa.
        </p>
      ) : null}
    </div>
  )
}
