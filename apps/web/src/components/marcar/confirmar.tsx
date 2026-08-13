'use client'

import { useActionState } from 'react'
import { confirmarMarcacao, type EstadoConfirmacao } from '@/app/marcar/actions'
import { Button } from '@/components/ui/button'
import { PhoneInput } from '@/components/ui/phone-input'
import { formatDateLong, formatDuration, formatMoney } from '@/lib/format'
import { pais } from '@/lib/pais'
import type { CasaEscolhivel, HorarioLivre, ServicoEscolhivel } from '@/lib/marcacao-tipos'

/**
 * Confirmar.
 *
 * O extrato vem primeiro e o formulário depois — nesta ordem nos dois tamanhos
 * de ecrã. A cliente precisa de ver o que está a fechar antes de datilografar o
 * telemóvel, e no telemóvel a coluna lateral não existe.
 *
 * Aqui o preço deixa de ser piso: a profissional está decidida, o motor já
 * resolveu quem faz o quê, e o número é o que ela vai pagar.
 *
 * O que vai para o servidor é o INSTANTE e o carrinho — nunca o plano. Quem
 * replaneja é `createAppointment`, no momento de gravar, porque entre esta tela
 * ter carregado e o botão ser premido outra pessoa pode ter marcado a mesma
 * cadeira.
 */
export function Confirmar({
  casa,
  servicos,
  horario,
  dia,
  profissional,
  cliente,
}: {
  casa: CasaEscolhivel
  servicos: readonly ServicoEscolhivel[]
  horario: HorarioLivre
  /**
   * A data de parede na casa, `YYYY-MM-DD`.
   *
   * Vem de fora e não se tira de `horario.inicio`: aquele é um instante em UTC,
   * e uma marcação das nove da noite no Brasil já é o dia seguinte em UTC. A
   * data que a cliente lê tem de ser a do calendário da casa.
   */
  dia: string
  profissional: string | null
  cliente: { nome: string; telefone: string } | null
}) {
  const [estado, accao, aEnviar] = useActionState<EstadoConfirmacao, FormData>(
    confirmarMarcacao,
    {},
  )
  const { rotulos } = pais()

  return (
    <section>
      <h1 className="display display-lg">Está quase.</h1>
      <p className="text-body measure mt-3 text-[1.0625rem]">
        Confira a visita e diga-nos quem é. A confirmação fica feita no momento.
      </p>

      {/* ── o extrato ────────────────────────────────────────────────────── */}
      <div className="mt-9 border-t border-(--border-strong) pt-5">
        <p className="font-medium">{casa.nome}</p>
        {casa.morada ? <p className="text-muted text-sm">{casa.morada}</p> : null}

        <p className="mt-3 text-[1.0625rem] first-letter:uppercase">
          {formatDateLong(dia)} às <span className="tnum font-medium">{horario.hora}</span>
        </p>

        <ul className="mt-5 border-t border-(--border-subtle)">
          {horario.equipa.map((item) => (
            <li
              key={`${item.servicoId}-${item.staffId}`}
              className="flex items-baseline justify-between gap-4 border-b border-(--border-subtle) py-2.5"
            >
              <span className="min-w-0">
                <span className="block text-[0.9375rem]">{item.servicoNome}</span>
                <span className="text-muted block text-[0.8125rem]">com {item.nome}</span>
              </span>
              {/* O preço da linha vem do horário, não do catálogo: aqui a
                  profissional já está decidida, e é o valor dela que soma no
                  total logo abaixo. */}
              <span className="tnum shrink-0 text-[0.9375rem]">{formatMoney(item.preco)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <span className="font-medium">
            Total
            <span className="text-muted tnum ml-2 font-normal">
              {formatDuration(horario.duracaoMin)}
            </span>
          </span>
          <span className="tnum display text-[1.75rem] leading-none">
            {formatMoney(horario.precoTotal)}
          </span>
        </div>
      </div>

      {/* ── quem é ───────────────────────────────────────────────────────── */}
      <form action={accao} className="mt-10">
        <input type="hidden" name="casa" value={casa.slug} />
        <input type="hidden" name="inicio" value={horario.inicio} />
        <input type="hidden" name="servicos" value={servicos.map((item) => item.id).join(',')} />
        {profissional ? <input type="hidden" name="profissional" value={profissional} /> : null}

        {/*
          O erro fica colado ao formulário e é lido em voz alta: a maior parte
          deles ("este horário acabou de ser ocupado") chega depois de a cliente
          já ter carregado no botão, e um recado no topo da página passaria
          despercebido no telemóvel.
        */}
        {estado.erro ? (
          <p
            role="alert"
            className="rounded-plate mb-5 border border-(--color-signal-bad)/35 bg-(--color-signal-bad)/6 px-4 py-3 text-sm text-(--color-signal-bad)"
          >
            {estado.erro}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome completo" htmlFor="nome">
            <input
              id="nome"
              name="nome"
              className="field"
              required
              autoComplete="name"
              defaultValue={cliente?.nome ?? ''}
              placeholder="Como devemos chamá-la"
            />
          </Campo>

          <Campo rotulo={rotulos.telemovel} htmlFor="telefone">
            <PhoneInput
              id="telefone"
              name="telefone"
              className="field"
              required
              defaultValue={cliente?.telefone ?? ''}
            />
          </Campo>
        </div>

        <div className="mt-4 grid gap-4">
          <Campo rotulo="E-mail" htmlFor="email" opcional>
            <input
              id="email"
              name="email"
              type="email"
              className="field"
              autoComplete="email"
              placeholder="para receber o comprovativo"
            />
          </Campo>

          <Campo rotulo="Alguma coisa que devamos saber?" htmlFor="observacao" opcional>
            <textarea
              id="observacao"
              name="observacao"
              rows={3}
              maxLength={400}
              className="field resize-y"
              placeholder="alergias, o que fez da última vez, a que horas tem de sair…"
            />
          </Campo>
        </div>

        <Button type="submit" size="xl" disabled={aEnviar} className="mt-7 w-full sm:w-auto">
          {aEnviar ? 'A marcar…' : 'Confirmar a marcação'}
        </Button>

        <p className="text-muted mt-4 text-[0.8125rem]">
          Pode cancelar ou remarcar pela sua conta até à véspera. Nada a pagar agora — o acerto é no
          salão.
        </p>
      </form>
    </section>
  )
}

function Campo({
  rotulo,
  htmlFor,
  opcional,
  children,
}: {
  rotulo: string
  htmlFor: string
  opcional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {rotulo}
        {opcional ? <span className="text-muted ml-1.5 font-normal">opcional</span> : null}
      </label>
      {children}
    </div>
  )
}
