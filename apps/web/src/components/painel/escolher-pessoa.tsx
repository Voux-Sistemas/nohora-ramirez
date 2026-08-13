'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { Vista } from '@/lib/periodo'

/**
 * De quem é a agenda que está na tela.
 *
 * Só aparece para quem gere. É a resposta à pergunta que a dona faz em voz alta
 * ("o que é que a Juliana tem na quinta?") sem ter de abrir a grade de um dia
 * de cada vez à procura de uma coluna.
 *
 * `select` nativo pela mesma razão do selector de casa: no tablet do balcão o
 * menu do sistema tem alvos grandes e funciona com a mão ocupada.
 */
export function EscolherPessoa({
  base,
  equipa,
  activo,
  vista,
  data,
}: {
  base: string
  equipa: readonly { id: string; nome: string }[]
  activo: string
  vista: Vista
  data: string
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()

  return (
    <div className="relative">
      <label className="sr-only" htmlFor="painel-pessoa">
        Agenda de
      </label>
      <select
        id="painel-pessoa"
        defaultValue={activo}
        disabled={pendente}
        onChange={(evento) => {
          const quem = evento.currentTarget.value
          /* A vista e a data vão junto: trocar de pessoa a meio da semana e
             cair no dia de hoje faria perder o sítio onde se estava a olhar. */
          iniciar(() => router.push(`${base}?v=${vista}&d=${data}&quem=${quem}` as never))
        }}
        className="rounded-plate h-10 max-w-52 cursor-pointer appearance-none border border-(--border-strong) bg-(--surface-raised) py-0 pr-9 pl-3 text-sm font-medium text-(--text-strong) transition-colors hover:bg-(--surface-sunken) disabled:opacity-50"
      >
        {equipa.map((pessoa) => (
          <option key={pessoa.id} value={pessoa.id}>
            {pessoa.nome}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
      >
        ▾
      </span>
    </div>
  )
}
