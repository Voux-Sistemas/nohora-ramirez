'use client'

import { Check } from 'lucide-react'
import { Barra } from '@/components/ui/esqueleto'
import { formatDuration, formatMoney } from '@/lib/format'
import type { CasaEscolhivel, ServicoEscolhivel } from '@/lib/marcacao-tipos'
import { cn } from '@/lib/utils'

/**
 * O quê.
 *
 * Régua editorial, não sopa de cartões: nome à esquerda, número à direita, fio
 * entre linhas — o desenho de um preçário de balcão, que é o objecto que esta
 * lista imita. Um cartão por serviço faria a cliente percorrer trinta caixas
 * para encontrar "Corte".
 *
 * Fotografia de serviço não entra aqui de propósito. Quatro serviços do
 * catálogo não têm foto (e alguns nunca terão — escova e retoque de raiz
 * fotografam mal), e uma lista com metade das linhas ilustradas lê como se
 * faltasse alguma coisa. Aqui a fotografia é a da casa, e ela já foi vista.
 */
export function EscolherServicos({
  casa,
  catalogo,
  escolhidos,
  aCarregar,
  aoAlternar,
}: {
  casa: CasaEscolhivel | null
  catalogo: readonly ServicoEscolhivel[]
  escolhidos: readonly string[]
  aCarregar: boolean
  aoAlternar: (id: string) => void
}) {
  const grupos = agrupar(catalogo)

  return (
    <section>
      <h1 className="display display-lg">O que vamos fazer?</h1>
      <p className="text-body measure mt-3 text-[1.0625rem]">
        {casa ? `${casa.nome}${casa.distrito ? ` · ${casa.distrito}` : ''}. ` : ''}
        Pode escolher mais do que um — marcamos tudo de seguida, na mesma visita.
      </p>

      {aCarregar && catalogo.length === 0 ? (
        <div className="mt-9 space-y-3">
          {[0, 1, 2, 3, 4].map((linha) => (
            <Barra key={linha} className="h-14 w-full" />
          ))}
        </div>
      ) : null}

      {!aCarregar && catalogo.length === 0 ? (
        <p className="text-muted mt-9">
          Esta casa ainda não tem serviços abertos para marcação online. Ligue para a recepção — ela
          marca por si.
        </p>
      ) : null}

      <div className="mt-9 space-y-10">
        {grupos.map((grupo) => (
          <div key={grupo.nome}>
            <h2 className="display display-md">{grupo.nome}</h2>
            <div className="rule-bronze mt-3 w-10" />

            <ul className="mt-4 border-t border-(--border-subtle)">
              {grupo.itens.map((servico) => (
                <li key={servico.id}>
                  <Linha
                    servico={servico}
                    marcado={escolhidos.includes(servico.id)}
                    aoAlternar={() => aoAlternar(servico.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

function Linha({
  servico,
  marcado,
  aoAlternar,
}: {
  servico: ServicoEscolhivel
  marcado: boolean
  aoAlternar: () => void
}) {
  return (
    /*
      `label` com uma caixa de verificação real e escondida: o teclado, o leitor
      de ecrã e o toque com a mão molhada continuam a funcionar como esperam,
      sem termos de reimplementar nenhum dos três.
    */
    <label
      className={cn(
        'flex cursor-pointer items-start gap-4 border-b border-(--border-subtle) px-2 py-3.5 transition-colors',
        marcado ? 'bg-(--accent-wash)/45' : 'hover:bg-(--surface-sunken)',
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={marcado}
        onChange={aoAlternar}
      />

      {/* Seleccionado é tinta — o mesmo idioma de selecção do sistema inteiro. */}
      <span
        aria-hidden
        className={cn(
          'rounded-plate mt-0.5 grid size-5 shrink-0 place-items-center border transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus)',
          marcado
            ? 'border-(--surface-invert) bg-(--surface-invert) text-(--on-invert)'
            : 'border-(--border-strong)',
        )}
      >
        {marcado ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] leading-snug font-medium">{servico.nome}</span>
        {servico.descricao ? (
          <span className="text-muted mt-0.5 block text-[0.8125rem] leading-snug">
            {servico.descricao}
          </span>
        ) : null}
        {servico.exigeAnamnese ? (
          /* Avisar antes, não na porta: a ficha leva tempo e a cliente que
             chega em cima da hora perde o horário por causa dela. */
          <span className="text-muted mt-1 block text-[0.75rem] italic">
            leva ficha de avaliação no primeiro atendimento
          </span>
        ) : null}
        {servico.sinal ? (
          <span className="text-muted mt-1 block text-[0.75rem]">sinal de {servico.sinal}</span>
        ) : null}
      </span>

      <span className="shrink-0 text-right">
        <span className="tnum block text-[0.9375rem] whitespace-nowrap">
          {servico.precoVaria ? (
            <span className="text-muted mr-1 text-[0.8125rem]">desde</span>
          ) : null}
          {formatMoney(servico.preco)}
        </span>
        <span className="tnum text-muted mt-0.5 block text-[0.75rem]">
          {formatDuration(servico.duracaoMin)}
        </span>
      </span>
    </label>
  )
}

function agrupar(catalogo: readonly ServicoEscolhivel[]) {
  const mapa = new Map<string, ServicoEscolhivel[]>()
  for (const servico of catalogo) {
    const lista = mapa.get(servico.categoria) ?? []
    lista.push(servico)
    mapa.set(servico.categoria, lista)
  }
  return [...mapa.entries()].map(([nome, itens]) => ({ nome, itens }))
}
