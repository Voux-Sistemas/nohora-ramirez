'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { confirmarAgendamento, type ConfirmState } from '@/app/agendar/[unidade]/confirmar/actions'

/**
 * Os três campos que faltam. Nome e WhatsApp porque o salão precisa avisar; a
 * observação porque alergia e horário apertado mudam o atendimento.
 *
 * Rótulo acima do campo, sempre — placeholder-como-rótulo some no instante em
 * que a cliente começa a digitar, que é justamente quando ela mais precisa
 * conferir se está no campo certo.
 */
export function ConfirmForm({
  unidade,
  servicos,
  inicio,
  profissional,
}: {
  unidade: string
  servicos: string
  inicio: string
  profissional?: string
}) {
  const [state, action] = useActionState<ConfirmState, FormData>(confirmarAgendamento, {})

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="unidade" value={unidade} />
      <input type="hidden" name="servicos" value={servicos} />
      <input type="hidden" name="inicio" value={inicio} />
      {profissional ? <input type="hidden" name="profissional" value={profissional} /> : null}

      <div>
        <label htmlFor="nome" className="mb-2 block text-sm font-medium">
          Seu nome
        </label>
        <input id="nome" name="nome" required autoComplete="name" className="field" />
      </div>

      <div>
        <label htmlFor="telefone" className="mb-2 block text-sm font-medium">
          WhatsApp
        </label>
        <input
          id="telefone"
          name="telefone"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(11) 99999-8888"
          aria-describedby="telefone-ajuda"
          className="field tnum"
        />
        <p id="telefone-ajuda" className="text-muted mt-1.5 text-xs">
          É por aqui que a confirmação e o lembrete chegam.
        </p>
      </div>

      <div>
        <label htmlFor="observacao" className="mb-2 block text-sm font-medium">
          Alguma observação? <span className="text-muted font-normal">(opcional)</span>
        </label>
        <textarea
          id="observacao"
          name="observacao"
          rows={3}
          maxLength={400}
          className="field resize-y"
          placeholder="Alergia, preferência, se vai chegar em cima da hora…"
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-plate border border-(--color-signal-bad)/40 bg-(--color-signal-bad)/8 p-3.5 text-sm text-(--color-signal-bad)"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />

      <p className="text-muted text-center text-xs">
        Ao confirmar você reserva o horário. Nada é cobrado agora.
      </p>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="xl" className="w-full" disabled={pending}>
      {pending ? 'Confirmando…' : 'Confirmar agendamento'}
    </Button>
  )
}
