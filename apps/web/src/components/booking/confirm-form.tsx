'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Erro } from '@/components/ui/erro'
import { ReguaDeEspera } from '@/components/ui/espera'
import { PhoneInput } from '@/components/ui/phone-input'
import { confirmarAgendamento, type ConfirmState } from '@/app/agendar/[unidade]/confirmar/actions'

/**
 * Os campos que faltam. Nome e WhatsApp porque o salão precisa avisar; a
 * observação porque alergia e horário apertado mudam o atendimento; o e-mail
 * porque é por ele que a cliente vai entrar na própria área depois — e pedir
 * agora, quando ela já está digitando, custa menos do que caçar o endereço
 * cliente por cliente no dia em que o login existir.
 *
 * Opcional de verdade: quem não quiser deixar agenda igual. Um agendamento
 * perdido por causa de um campo a mais é caro; um e-mail a menos, não.
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
          O seu nome
        </label>
        <input id="nome" name="nome" required autoComplete="name" className="field" />
      </div>

      <div>
        <label htmlFor="telefone" className="mb-2 block text-sm font-medium">
          WhatsApp
        </label>
        <PhoneInput
          id="telefone"
          name="telefone"
          required
          aria-describedby="telefone-ajuda"
          className="field tnum"
        />
        <p id="telefone-ajuda" className="text-muted mt-1.5 text-xs">
          É por aqui que a confirmação e o lembrete chegam.
        </p>
      </div>

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium">
          E-mail <span className="text-muted font-normal">(opcional)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="nome@exemplo.com"
          aria-describedby="email-ajuda"
          className="field"
        />
        <p id="email-ajuda" className="text-muted mt-1.5 text-xs">
          Para poder acompanhar as suas marcações pelo site. Não enviamos publicidade.
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

      <Erro>{state.error}</Erro>

      <SubmitButton />

      <p className="text-muted text-center text-xs">
        Ao confirmar, reserva o horário. Não é cobrado nada agora.
      </p>
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <>
      {/* A espera mais longa do fluxo: aqui grava-se a marcação e sai o aviso. */}
      <ReguaDeEspera ativa={pending} />
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? 'A confirmar…' : 'Confirmar marcação'}
      </Button>
    </>
  )
}
