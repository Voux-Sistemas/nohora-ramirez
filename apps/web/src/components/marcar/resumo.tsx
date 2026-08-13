'use client'

import { formatDateLong, formatDuration, formatMoney } from '@/lib/format'
import type {
  CasaEscolhivel,
  HorarioLivre,
  ProfissionalEscolhivel,
  ServicoEscolhivel,
} from '@/lib/marcacao-tipos'

/**
 * O extrato.
 *
 * Existe porque a marcação passou a ser uma tela só: sem ele, a cliente que
 * está a escolher a hora deixou de ver o que pôs no carrinho três passos
 * atrás. Não é um cartão de resumo genérico — é a conta a formar-se, linha a
 * linha, com o total sempre à vista.
 *
 * Nada de placa dentro de placa: o bloco separa-se por fio, como o resto do
 * sistema.
 */
export function Resumo({
  casa,
  servicos,
  profissional,
  horario,
  dia,
}: {
  casa: CasaEscolhivel | null
  servicos: readonly ServicoEscolhivel[]
  profissional: ProfissionalEscolhivel | null
  horario: HorarioLivre | null
  dia: string | null
}) {
  if (!casa) return null

  const duracao = servicos.reduce((soma, item) => soma + item.duracaoMin, 0)
  /* Com hora escolhida o preço deixa de ser piso: o motor já resolveu quem
     atende, e é esse o valor que a cliente vai pagar. */
  const total = horario?.precoTotal ?? servicos.reduce((soma, item) => soma + item.preco, 0)
  const piso = !horario && servicos.some((item) => item.precoVaria)

  return (
    <div className="border-t border-(--border-strong) pt-5">
      <h2 className="label-caps text-muted">A sua visita</h2>

      <p className="mt-2 font-medium">{casa.nome}</p>
      {casa.morada ? <p className="text-muted text-[0.8125rem]">{casa.morada}</p> : null}

      {servicos.length > 0 ? (
        <dl className="mt-5 border-t border-(--border-subtle)">
          {servicos.map((servico) => {
            /* Com hora escolhida o preço da linha passa a ser o da profissional
               que ficou com ela — o mesmo que soma no total. Antes da hora, é o
               piso da casa, e o total ao pé diz "desde". */
            const resolvido = horario?.equipa.find((item) => item.servicoId === servico.id)
            return (
              <div
                key={servico.id}
                className="flex items-baseline justify-between gap-3 border-b border-(--border-subtle) py-2"
              >
                <dt className="min-w-0 text-[0.8125rem] leading-snug">{servico.nome}</dt>
                <dd className="tnum shrink-0 text-[0.8125rem]">
                  {formatMoney(resolvido?.preco ?? servico.preco)}
                </dd>
              </div>
            )
          })}
        </dl>
      ) : null}

      {profissional ? (
        <p className="text-body mt-4 text-[0.8125rem]">
          com <span className="text-(--text-strong)">{profissional.nome}</span>
        </p>
      ) : null}

      {horario && dia ? (
        <p className="text-body mt-1 text-[0.8125rem] first-letter:uppercase">
          {formatDateLong(dia)} às <span className="tnum text-(--text-strong)">{horario.hora}</span>
        </p>
      ) : null}

      {servicos.length > 0 ? (
        <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-(--border-strong) pt-4">
          <span className="text-sm font-medium">
            Total
            <span className="text-muted tnum ml-2 font-normal">{formatDuration(duracao)}</span>
          </span>
          <span className="tnum display text-[1.5rem] leading-none">
            {piso ? <span className="text-muted mr-1 text-[0.75rem]">desde</span> : null}
            {formatMoney(total)}
          </span>
        </div>
      ) : null}
    </div>
  )
}
