'use client'

import { Avatar } from '@/components/ui/avatar'
import { Barra } from '@/components/ui/esqueleto'
import type { ProfissionalEscolhivel } from '@/lib/marcacao-tipos'
import { cn } from '@/lib/utils'

/**
 * Com quem.
 *
 * "Sem preferência" está no topo e não é o prémio de consolação: é a escolha
 * que abre mais horas, e dizê-lo é honesto — quem tem pressa ganha em escolhê-la,
 * quem quer a Juliana escolhe a Juliana e aceita esperar. Esconder isso faria a
 * cliente lutar com um calendário vazio sem perceber porquê.
 *
 * Retrato só quando o salão tiver subido o real. Até lá, iniciais sobre a cor
 * da profissional — a mesma cor que ela tem na agenda da casa.
 */
export function EscolherQuem({
  equipa,
  escolhido,
  aCarregar,
  aoEscolher,
}: {
  equipa: readonly ProfissionalEscolhivel[]
  escolhido: string | null
  aCarregar: boolean
  aoEscolher: (id: string | null) => void
}) {
  return (
    <section>
      <h1 className="display display-lg">Com quem?</h1>
      <p className="text-body measure mt-3 text-[1.0625rem]">
        Todas fazem o que escolheu. Se não tiver preferência, damos-lhe a primeira que estiver
        livre — e aparecem mais horários.
      </p>

      {aCarregar && equipa.length === 0 ? (
        <div className="mt-9 space-y-3">
          {[0, 1, 2].map((linha) => (
            <Barra key={linha} className="h-16 w-full" />
          ))}
        </div>
      ) : null}

      {!aCarregar && equipa.length === 0 ? (
        <p className="text-muted mt-9">
          Ninguém desta casa tem, de momento, todos os serviços que escolheu na mesma visita. Tire
          um serviço do carrinho ou ligue para a recepção — ela consegue dividir a visita.
        </p>
      ) : (
        <fieldset className="mt-9">
          <legend className="sr-only">Profissional</legend>
          <ul className="border-t border-(--border-subtle)">
            <li>
              <Opcao
                marcado={escolhido === null}
                aoEscolher={() => aoEscolher(null)}
                titulo="Sem preferência"
                apoio="A primeira livre no horário que escolher"
                destaque
              />
            </li>
            {equipa.map((pessoa) => (
              <li key={pessoa.id}>
                <Opcao
                  marcado={escolhido === pessoa.id}
                  aoEscolher={() => aoEscolher(pessoa.id)}
                  titulo={pessoa.nome}
                  avatar={<Avatar name={pessoa.nome} color={pessoa.cor} size="md" />}
                />
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </section>
  )
}

function Opcao({
  marcado,
  aoEscolher,
  titulo,
  apoio,
  avatar,
  destaque,
}: {
  marcado: boolean
  aoEscolher: () => void
  titulo: string
  apoio?: string
  avatar?: React.ReactNode
  destaque?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-4 border-b border-(--border-subtle) px-2 py-3.5 transition-colors',
        marcado ? 'bg-(--accent-wash)/45' : 'hover:bg-(--surface-sunken)',
      )}
    >
      <input
        type="radio"
        name="profissional-escolha"
        className="peer sr-only"
        checked={marcado}
        onChange={aoEscolher}
      />

      <span
        aria-hidden
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
          'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--focus)',
          marcado ? 'border-(--surface-invert)' : 'border-(--border-strong)',
        )}
      >
        {marcado ? <span className="size-2.5 rounded-full bg-(--surface-invert)" /> : null}
      </span>

      {avatar ??
        (destaque ? (
          /* A opção sem rosto não fica com um buraco onde as outras têm cara:
             o lugar do retrato é ocupado pela coroa da marca, em miniatura. */
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full bg-(--surface-sunken) text-[0.6875rem] font-semibold tracking-[0.08em] text-(--text-muted) ring-1 ring-(--border-subtle) ring-inset"
          >
            NR
          </span>
        ) : null)}

      <span className="min-w-0 flex-1">
        <span className="block font-medium">{titulo}</span>
        {apoio ? <span className="text-muted block text-[0.8125rem]">{apoio}</span> : null}
      </span>
    </label>
  )
}
