'use client'

import { useTransition } from 'react'
import { trocarUnidade } from '@/server/painel/actions'

/**
 * A casa activa do painel.
 *
 * Um `select` nativo de propósito: no tablet do balcão o menu do sistema abre
 * como roda, com alvos grandes, e funciona com a mão molhada. Um dropdown
 * desenhado por nós seria mais bonito e pior — e esta é a troca mais repetida
 * do turno depois de mudar de dia.
 *
 * Submete no `change` em vez de ter um botão "trocar": ninguém escolhe a loja
 * e depois decide não ir para ela.
 */
export function UnitSwitcher({
  unidades,
  activa,
}: {
  unidades: readonly { slug: string; name: string }[]
  activa: string
}) {
  const [pendente, iniciar] = useTransition()

  // Uma casa só não é uma escolha — é um facto. Vira etiqueta.
  if (unidades.length <= 1) {
    return (
      <span className="text-muted truncate text-sm" title={unidades[0]?.name}>
        {unidades[0]?.name ?? '—'}
      </span>
    )
  }

  return (
    <form
      action={trocarUnidade}
      className="relative"
      onChange={(event) => {
        const form = event.currentTarget
        iniciar(() => form.requestSubmit())
      }}
    >
      <label className="sr-only" htmlFor="painel-unidade">
        Casa
      </label>
      <select
        id="painel-unidade"
        name="slug"
        defaultValue={activa}
        disabled={pendente}
        className="rounded-plate h-10 max-w-52 cursor-pointer appearance-none border border-(--border-strong) bg-(--surface-raised) py-0 pr-9 pl-3 text-sm font-medium text-(--text-strong) transition-colors hover:bg-(--surface-sunken) disabled:opacity-50"
      >
        {unidades.map((unidade) => (
          <option key={unidade.slug} value={unidade.slug}>
            {unidade.name}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="text-muted pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
      >
        ▾
      </span>
    </form>
  )
}
