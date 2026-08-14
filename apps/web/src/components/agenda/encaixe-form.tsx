'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { criarEncaixe, type EncaixeState } from '@/app/agenda/[unidade]/encaixe/actions'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/phone-input'

export function EncaixeForm({
  unidade,
  data,
  servicos,
  inicio,
  profissional,
  nome,
  telefone,
}: {
  unidade: string
  data: string
  servicos: string
  inicio: string
  profissional?: string
  nome?: string
  telefone?: string
}) {
  const [state, action] = useActionState<EncaixeState, FormData>(criarEncaixe, {})

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unidade" value={unidade} />
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="servicos" value={servicos} />
      <input type="hidden" name="inicio" value={inicio} />
      {profissional ? <input type="hidden" name="profissional" value={profissional} /> : null}

      <Field label="Nome da cliente">
        <input
          name="nome"
          required
          defaultValue={nome ?? ''}
          autoComplete="off"
          className="field"
        />
      </Field>

      <Field label="WhatsApp" hint="é por aqui que o lembrete vai sair">
        <PhoneInput name="telefone" required defaultValue={telefone ?? ''} className="field" />
      </Field>

      <Field label="Observação interna" hint="não aparece para a cliente">
        <textarea name="observacao" rows={2} className="field resize-none" />
      </Field>

      {state.error ? (
        <p className="rounded-plate border border-(--estado-mau)/40 bg-(--estado-mau)/8 px-3 py-2 text-sm text-(--estado-mau)">
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  )
}

function Submit() {
  const { pending } = useFormStatus()
  return (
    <Button size="lg" className="w-full" disabled={pending}>
      {pending ? 'Marcando…' : 'Confirmar encaixe'}
    </Button>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="text-muted mt-1 block text-xs">{hint}</span> : null}
    </label>
  )
}
