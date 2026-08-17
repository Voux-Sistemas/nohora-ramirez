import { isoDateInZone } from '@studio/core'
import Link from 'next/link'
import { STATUS_LABEL } from '@/components/agenda/appointment-panel'
import { requireClientSession } from '@/server/auth/session'
import { sair } from '@/server/auth/actions'
import { PerfilForm } from '@/components/auth/perfil-form'
import { FaixaDaMarca } from '@/components/brand/faixa'
import { getContaIdentidade } from '@/server/people/clients'
import { listClientAppointments } from '@/server/scheduling/queries'
import { formatMoney, formatDateLong, formatTime } from '@/lib/format'
import { buttonVariants } from '@/components/ui/button'
import { cn, href } from '@/lib/utils'
import { CancelButton } from '@/components/auth/cancel-button'

export const metadata = { title: 'A minha conta' }

const OPEN_STATUSES = new Set(['draft', 'scheduled', 'confirmed', 'checked_in', 'in_progress'])

type Marcacao = Awaited<ReturnType<typeof listClientAppointments>>[number]

/**
 * A conta da cliente.
 *
 * Traz a faixa de tinta do fluxo de marcação, e isso não é enfeite: ela acabou
 * de atravessar quatro passos com esta placa no topo, e aterrava aqui numa tela
 * nua. Era a fronteira invisível do produto — a mesma pessoa, o mesmo percurso,
 * dois sítios que não se pareciam.
 *
 * As secções eram quatro caixas empilhadas, cada uma com fio e vinte pixels de
 * respiro por dentro. Caixa serve para separar o que está misturado; aqui nada
 * estava misturado, e o que a caixa fazia era pôr uma parede à volta de uma
 * lista que já se via muito bem. Ficam as réguas de bronze — a mesma marca de
 * secção do passo de horários.
 */
export default async function ContaPage() {
  const session = await requireClientSession()
  const [appointments, identidade] = await Promise.all([
    listClientAppointments(session.clientId!, 50),
    getContaIdentidade(session.userId),
  ])

  const abertas = new Set(
    appointments
      .filter((a) => OPEN_STATUSES.has(a.status) && a.start.getTime() > Date.now())
      .map((a) => a.id),
  )
  const upcoming = appointments
    .filter((a) => abertas.has(a.id))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  const history = appointments.filter((a) => !abertas.has(a.id))

  return (
    <div className="flex min-h-dvh flex-col">
      <FaixaDaMarca
        largura="max-w-2xl"
        fim={
          <form action={sair} className="flex justify-end">
            {/* Botão de texto, e não o `Button` do sistema: sobre tinta, os
                fundos das variantes não têm contraste que se aproveite. Aqui
                vale o mesmo tratamento do contador de passos. */}
            <button
              type="submit"
              className="label-caps cursor-pointer text-(--on-ink-muted) transition-colors hover:text-(--on-ink)"
            >
              Sair
            </button>
          </form>
        }
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
        <h1 className="display display-md">Olá, {session.name.split(' ')[0]}</h1>

        {/*
          A marcação nova é a razão nº 2 para ela abrir isto — a nº 1 é ver o
          horário que já marcou, e esse aparece logo a seguir. Por isso o botão
          não ocupa a largura toda em ecrã grande: largura total é o peso de uma
          acção que é a única da tela, e aqui não é.
        */}
        <Link
          href={href('/agendar')}
          className={cn(buttonVariants({ size: 'lg' }), 'mt-6 w-full sm:w-auto')}
        >
          Marcar novo horário
        </Link>

        <Secao titulo="Próximas marcações">
          {upcoming.length === 0 ? (
            <Vazio>Não tem nenhum horário marcado neste momento.</Vazio>
          ) : (
            <ul>
              {upcoming.map((a) => (
                <LinhaDeMarcacao key={a.id} marcacao={a} acao={<CancelButton id={a.id} />} />
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Histórico">
          {history.length === 0 ? (
            <Vazio>Ainda não nos visitou. A primeira vez fica registada aqui.</Vazio>
          ) : (
            <ul>
              {history.map((a) => (
                <LinhaDeMarcacao key={a.id} marcacao={a} />
              ))}
            </ul>
          )}
        </Secao>

        {/* Os meus dados vêm por último: ela entrou para ver o horário, não para
            editar a ficha. Mas tem de existir — sem isto, corrigir um nome mal
            escrito ou um e-mail que já não usa obrigava a ligar para o salão.

            É a única secção com placa à volta, e é o que a distingue: acima
            lê-se, aqui escreve-se. */}
        {identidade ? (
          <Secao titulo="Os meus dados">
            <div className="plate p-5">
              <PerfilForm
                nome={identidade.name}
                telefone={identidade.phone}
                email={identidade.email}
              />
            </div>
          </Secao>
        ) : null}
      </main>
    </div>
  )
}

/** Título de secção com régua de bronze — o mesmo do passo de horários. */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-11">
      <div className="mb-4 flex items-baseline gap-4">
        <h2 className="shrink-0 text-sm font-semibold">{titulo}</h2>
        <span className="rule-bronze min-w-0 flex-1" aria-hidden />
      </div>
      {children}
    </section>
  )
}

/**
 * Uma linha de marcação. Era o mesmo bloco copiado nas próximas e no histórico,
 * com a única diferença de haver ou não botão de cancelar.
 */
function LinhaDeMarcacao({ marcacao, acao }: { marcacao: Marcacao; acao?: React.ReactNode }) {
  const servicos = marcacao.items.map((item) => item.serviceName).join(', ')

  return (
    <li className="border-t border-(--border-subtle) py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="font-medium">
          {formatDateLong(isoDateInZone(marcacao.start, marcacao.timezone))}
        </span>
        <span className="text-muted tnum text-sm">
          {formatTime(marcacao.start, marcacao.timezone)} · {marcacao.unitName}
        </span>
      </div>

      <p className="text-muted mt-1 text-sm">
        {servicos} — <span className="tnum">{formatMoney(marcacao.totalPrice)}</span>
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="label-caps text-muted">
          {STATUS_LABEL[marcacao.status] ?? marcacao.status}
        </span>
        {acao}
      </div>
    </li>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted rounded-plate border border-dashed border-(--border-subtle) px-5 py-6 text-sm">
      {children}
    </p>
  )
}
