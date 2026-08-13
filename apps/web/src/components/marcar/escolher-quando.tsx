'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Barra } from '@/components/ui/esqueleto'
import { formatDateLong, formatWeekdayShort } from '@/lib/format'
import type { DiaLivre, HorarioLivre } from '@/lib/marcacao-tipos'
import { cn } from '@/lib/utils'

/**
 * Quando.
 *
 * ── A decisão de desenho que manda aqui ───────────────────────────────────
 * Um calendário de mês inteiro é o reflexo de toda ferramenta de marcação, e é
 * o desenho errado para um salão: a cliente não quer "17 de Setembro", quer
 * "sábado de manhã". A tira de dias mostra catorze dias seguidos com o dia da
 * semana escrito por extenso curto, marca os que têm vaga e apaga os que não
 * têm — a leitura é "há sábado?" e não "que número é o sábado?".
 *
 * A tira abre já no primeiro dia com hora livre. Fazer a cliente descobrir
 * sozinha, a clicar em dias vazios, é trabalho que o servidor já fez.
 *
 * A pastilha de hora é a mesma de todo o sistema — `h-14`, raio de placa,
 * afunda 1px ao clicar — e é idêntica no encaixe e na remarcação da recepção.
 */
export function EscolherQuando({
  dias,
  dia,
  horario,
  aCarregar,
  semProfissional,
  deData,
  aoEscolherDia,
  aoEscolherHorario,
  aoMudarJanela,
}: {
  dias: readonly DiaLivre[]
  dia: string | null
  horario: HorarioLivre | null
  aCarregar: boolean
  /** Sem profissional fixa, cada hora pode cair numa pessoa diferente. */
  semProfissional: boolean
  deData: string | null
  aoEscolherDia: (data: string) => void
  aoEscolherHorario: (horario: HorarioLivre) => void
  aoMudarJanela: (novaData: string | null) => void
}) {
  const doDia = dias.find((item) => item.data === dia)
  const blocos = doDia ? repartirPorPeriodo(doDia.horarios) : []
  const nenhumDiaLivre = dias.length > 0 && dias.every((item) => item.horarios.length === 0)

  return (
    <section>
      <h1 className="display display-lg">Quando lhe dá jeito?</h1>
      <p className="text-body measure mt-3 text-[1.0625rem]">
        Estes são os horários realmente livres. O que está aqui, está garantido até confirmar.
      </p>

      {/* ── a tira de dias ───────────────────────────────────────────────── */}
      <div className="mt-9 flex items-center gap-2">
        <BotaoJanela
          rotulo="Catorze dias antes"
          desactivado={deData === null || aCarregar}
          onClick={() => aoMudarJanela(recuar(deData, dias.length || 14))}
        >
          <ChevronLeft className="size-4" strokeWidth={2} />
        </BotaoJanela>

        <div className="min-w-0 flex-1 overflow-x-auto">
          {aCarregar && dias.length === 0 ? (
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <Barra key={i} className="h-[4.5rem] w-16 shrink-0" />
              ))}
            </div>
          ) : (
            <ul className="flex gap-2">
              {dias.map((item) => (
                <li key={item.data}>
                  <Dia
                    dia={item}
                    activo={item.data === dia}
                    aoEscolher={() => aoEscolherDia(item.data)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <BotaoJanela
          rotulo="Catorze dias depois"
          desactivado={aCarregar || dias.length === 0}
          onClick={() => aoMudarJanela(avancar(dias[dias.length - 1]?.data ?? null))}
        >
          <ChevronRight className="size-4" strokeWidth={2} />
        </BotaoJanela>
      </div>

      {/* ── as horas do dia ──────────────────────────────────────────────── */}
      <div className="mt-9">
        {nenhumDiaLivre ? (
          <p className="text-muted rounded-plate border border-dashed border-(--border-strong) px-5 py-8 text-center text-sm">
            Nada livre nestes catorze dias
            {semProfissional ? '' : ' com a profissional que escolheu'}. Avance para os catorze
            seguintes
            {semProfissional ? '' : ' ou volte atrás e escolha “sem preferência”'}.
          </p>
        ) : null}

        {!nenhumDiaLivre && doDia ? (
          <>
            <h2 className="text-sm font-medium first-letter:uppercase">
              {formatDateLong(doDia.data)}
            </h2>

            {doDia.horarios.length === 0 ? (
              <p className="text-muted mt-3 text-sm">
                {doDia.fechada ? 'A casa não abre neste dia.' : 'Este dia está cheio.'}
              </p>
            ) : null}

            <div className="mt-4 space-y-7">
              {blocos.map((bloco) => (
                <div key={bloco.nome}>
                  <h3 className="label-caps text-muted">{bloco.nome}</h3>
                  <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {bloco.horarios.map((item) => {
                      const activo = horario?.inicio === item.inicio
                      return (
                        <li key={item.inicio}>
                          <button
                            type="button"
                            onClick={() => aoEscolherHorario(item)}
                            aria-pressed={activo}
                            className={cn(
                              'tnum rounded-plate h-14 w-full border text-[0.9375rem] transition-[background-color,border-color,color,transform]',
                              'active:translate-y-px',
                              activo
                                ? 'border-(--surface-invert) bg-(--surface-invert) font-medium text-(--on-invert)'
                                : 'border-(--border-subtle) bg-(--surface-raised) hover:border-(--border-strong) hover:bg-(--surface-sunken)',
                            )}
                          >
                            {item.hora}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}

function Dia({
  dia,
  activo,
  aoEscolher,
}: {
  dia: DiaLivre
  activo: boolean
  aoEscolher: () => void
}) {
  const livre = dia.horarios.length > 0

  return (
    <button
      type="button"
      onClick={aoEscolher}
      disabled={!livre}
      aria-pressed={activo}
      className={cn(
        'rounded-plate flex h-[4.5rem] w-16 flex-col items-center justify-center gap-0.5 border transition-colors',
        activo
          ? 'border-(--surface-invert) bg-(--surface-invert) text-(--on-invert)'
          : livre
            ? 'border-(--border-subtle) bg-(--surface-raised) hover:border-(--border-strong) hover:bg-(--surface-sunken)'
            : /* Dia sem vaga não desaparece da tira: sumir faria a semana
                 parecer mais curta e a cliente procurar o sábado que "não
                 existe". Fica apagado, que é a verdade. */
              'cursor-not-allowed border-(--border-subtle) text-(--text-muted) opacity-45',
      )}
    >
      <span className="text-[0.6875rem] tracking-[0.06em] uppercase">
        {formatWeekdayShort(dia.data)}
      </span>
      <span className="tnum text-lg leading-none font-medium">{Number(dia.data.slice(8, 10))}</span>
      <span
        aria-hidden
        className={cn(
          'h-1 w-1 rounded-full',
          livre ? (activo ? 'bg-(--on-invert)' : 'bg-(--accent)') : 'bg-transparent',
        )}
      />
    </button>
  )
}

function BotaoJanela({
  rotulo,
  desactivado,
  onClick,
  children,
}: {
  rotulo: string
  desactivado: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desactivado}
      onClick={onClick}
      className="rounded-plate grid size-11 shrink-0 place-items-center border border-(--border-strong) text-(--text-body) transition-colors hover:bg-(--surface-sunken) disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/*
  Manhã, tarde e noite — não uma coluna de trinta horas seguidas. É como uma
  pessoa fala do próprio dia, e corta a lista em pedaços que se percorrem de
  relance. Os limites são os do turno de um salão, não os do relógio.
*/
function repartirPorPeriodo(horarios: readonly HorarioLivre[]) {
  const blocos = [
    { nome: 'Manhã', ate: 12, horarios: [] as HorarioLivre[] },
    { nome: 'Tarde', ate: 18, horarios: [] as HorarioLivre[] },
    { nome: 'Fim do dia', ate: 24, horarios: [] as HorarioLivre[] },
  ]

  for (const horario of horarios) {
    const hora = Number(horario.hora.slice(0, 2))
    const bloco = blocos.find((item) => hora < item.ate) ?? blocos[blocos.length - 1]!
    bloco.horarios.push(horario)
  }

  return blocos.filter((bloco) => bloco.horarios.length > 0)
}

/*
  Aritmética de calendário sobre `YYYY-MM-DD`, e não sobre um instante. Somar
  dias a uma data de parede não envolve fuso nenhum — é contar no calendário —
  e é por isso que `Date.UTC` aqui está certo e `new Date(iso)` estaria errado.
*/
function deslocar(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number]
  const instante = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return instante.toISOString().slice(0, 10)
}

function avancar(ultima: string | null): string | null {
  return ultima ? deslocar(ultima, 1) : null
}

/** `null` volta a "a partir de hoje", que é quem o servidor sabe calcular. */
function recuar(inicio: string | null, dias: number): string | null {
  if (!inicio) return null
  const anterior = deslocar(inicio, -dias)
  const hoje = new Date().toISOString().slice(0, 10)
  return anterior <= hoje ? null : anterior
}
