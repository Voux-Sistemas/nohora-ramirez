'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { importarCsv, type ImportState } from '@/app/painel/clientes/importar/actions'

export function ImportForm() {
  const [state, action] = useActionState<ImportState, FormData>(importarCsv, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Arquivo CSV
        <input className="field" name="file" type="file" accept=".csv,text/csv" required />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 p-3 text-sm text-(--color-signal-bad)"
        >
          {state.error}
        </p>
      ) : null}

      {state.result ? (
        <div className="rounded-lg border border-(--border-subtle) p-3 text-sm">
          <p>
            {state.result.created} nova(s) · {state.result.updated} já existiam
            {state.result.skipped.length > 0 ? ` · ${state.result.skipped.length} ignorada(s)` : ''}
          </p>
          {state.result.skipped.length > 0 ? (
            <ul className="text-muted mt-2 list-disc pl-5">
              {state.result.skipped.map((s) => (
                <li key={s.row}>
                  linha {s.row} ({s.name}): {s.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Importando…' : 'Importar'}
    </Button>
  )
}
