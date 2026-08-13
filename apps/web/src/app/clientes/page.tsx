import Link from 'next/link'
import { Avatar } from '@/components/ui/avatar'
import { formatPhone } from '@/lib/format'
import { href } from '@/lib/utils'
import { listClientsDirectory, type ClientDirectoryRow } from '@/server/people/clients'

/**
 * O livro de clientes.
 *
 * Era uma placa com vinte e nove linhas iguais: nome à esquerda, telefone à
 * direita, meio palmo de nada no meio. Uma lista assim não é uma carteira — é
 * um dump da tabela `users` com bordas arredondadas.
 *
 * O que a recepção de fato faz aqui: procura alguém pelo começo do nome, e
 * quando acha precisa saber na mesma linha se é cliente da casa ou alguém que
 * sumiu. Então o desenho é o de uma agenda de papel: as iniciais em ordem, cada
 * letra abrindo seu bloco, e a última visita fechando a linha. A rolagem por
 * letra é a busca que não exige digitar.
 */

/* A aba de índice na margem do desktop precisa do alfabeto inteiro, não só
   das letras que aparecem — senão "faltam" letras em vez de aparecerem
   apagadas, e a régua muda de tamanho a cada busca. */
const ALFABETO = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#']

/** Fatia a lista já ordenada em blocos por inicial, preservando a ordem. */
function porInicial(clients: ClientDirectoryRow[]): [string, ClientDirectoryRow[]][] {
  const blocos: [string, ClientDirectoryRow[]][] = []
  for (const client of clients) {
    /* Sem inicial reconhecível (nome só com pontuação, importação torta) o
       bloco é "#" — a cliente aparece na lista em vez de sumir dela. */
    const bruta = client.name.trim().charAt(0).toUpperCase()
    const letra = /\p{L}/u.test(bruta) ? bruta : '#'
    const ultimo = blocos[blocos.length - 1]
    if (ultimo && ultimo[0] === letra) ultimo[1].push(client)
    else blocos.push([letra, [client]])
  }
  return blocos
}

/**
 * "Quando ela esteve aqui" em linguagem de recepção.
 *
 * A data exata não serve de nada de relance — o que muda a conversa é a ordem
 * de grandeza. Dia, semana, mês e ano são as únicas quatro respostas que fazem
 * alguém agir de forma diferente.
 */
function desdeAVisita(date: Date): string {
  const dias = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (dias <= 0) return 'veio hoje'
  if (dias === 1) return 'ontem'
  if (dias < 7) return `há ${dias} dias`
  if (dias < 31) {
    const semanas = Math.floor(dias / 7)
    return `há ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`
  }
  if (dias < 365) {
    const meses = Math.max(1, Math.round(dias / 30))
    return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  }
  const anos = Math.floor(dias / 365)
  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const clients = await listClientsDirectory(q ?? '')
  const blocos = porInicial(clients)
  const presentes = new Set(blocos.map(([letra]) => letra))

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      {/* A aba do índice: mesma ideia da unha recortada na lateral de uma
          agenda telefônica de papel, só que sem recortar nada. Some abaixo de
          lg — no celular o polegar já rola o próprio dedo pela lista. */}
      {blocos.length > 1 ? (
        <nav
          aria-label="Ir para a letra"
          className="fixed top-1/2 right-3 z-(--z-sticky) hidden -translate-y-1/2 flex-col items-center xl:flex"
        >
          {ALFABETO.map((letra) =>
            presentes.has(letra) ? (
              <a
                key={letra}
                href={`#bloco-${letra}`}
                className="text-muted flex h-4 w-4 items-center justify-center text-[0.625rem] leading-none font-medium transition-colors hover:text-(--accent)"
              >
                {letra}
              </a>
            ) : (
              <span
                key={letra}
                aria-hidden
                className="flex h-4 w-4 items-center justify-center text-[0.625rem] leading-none text-(--border-strong)"
              >
                {letra}
              </span>
            ),
          )}
        </nav>
      ) : null}

      {/* Sem "← início": a barra de cima já leva a Hoje, e dois caminhos iguais
          a um palmo um do outro só fazem parar para escolher. */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h1 className="display text-[2rem] leading-[1.1] font-normal sm:text-[2.5rem]">
            Clientes
          </h1>
          <p className="text-muted mt-1 text-sm">Ficha, preferências e histórico de visitas.</p>
        </div>
        <Link
          href={href('/clientes/importar')}
          className="rounded-plate text-muted hover:text-(--text-strong) py-1 text-sm whitespace-nowrap transition-colors"
        >
          importar CSV →
        </Link>
      </header>

      <form className="mt-6" role="search">
        <label htmlFor="busca-cliente" className="sr-only">
          Buscar cliente por nome ou telefone
        </label>
        <input
          id="busca-cliente"
          className="field"
          type="search"
          name="q"
          placeholder="Buscar por nome ou telefone…"
          defaultValue={q ?? ''}
        />
      </form>

      {clients.length === 0 ? (
        <p className="text-muted mt-8 border-t border-(--border-strong) pt-8 text-sm">
          {q ? (
            <>
              Nenhuma cliente com <strong className="text-(--text-strong)">{q}</strong>. O cadastro
              novo nasce na primeira reserva, ou pela importação de CSV.
            </>
          ) : (
            'Nenhuma cliente cadastrada ainda. A primeira entra sozinha na primeira reserva.'
          )}
        </p>
      ) : (
        <>
          {/* Quantas são: honesto, é uma contagem do que está na tela, e é a
              primeira pergunta de quem abre a carteira. O limite da consulta
              aparece como "primeiras N" para não mentir sobre o total. */}
          <p className="text-muted mt-6 text-sm">
            {clients.length === 60 ? 'Primeiras 60' : clients.length}
            {clients.length === 1 ? ' cliente' : ' clientes'}
            {q ? ' encontradas' : ''}.
          </p>

          {blocos.map(([letra, linhas]) => (
            <section
              key={letra}
              id={`bloco-${letra}`}
              className="mt-5 scroll-mt-6 grid grid-cols-[1.75rem_1fr] gap-x-3 first:mt-3 sm:grid-cols-[2.5rem_1fr] sm:gap-x-4"
            >
              {/*
                A letra mora na margem, não numa faixa própria. Como faixa, um
                bloco de um nome só custava três linhas de altura para carregar
                uma — numa base de trinta pessoas a tela virava mais índice do
                que carteira. Na margem ela não ocupa nada quando o bloco é
                curto, e gruda no topo enquanto um bloco longo passa, que é
                exatamente o que a aba de uma agenda de papel faz.

                Bodoni a 28px: o corpo mínimo em que uma didone tem serifa em
                vez de sujeira.
              */}
              <h2 className="display text-muted sticky top-3 self-start pt-2.5 text-[1.75rem] leading-none font-normal">
                {letra}
              </h2>

              <ul className="border-t border-(--border-strong)">
                {linhas.map((client) => (
                  <li key={client.clientId}>
                    <Link
                      href={href(`/clientes/${client.clientId}`)}
                      className="group flex items-center gap-3 border-b border-(--border-subtle) px-2 py-3 transition-colors hover:bg-(--surface-sunken) sm:gap-4"
                    >
                      <Avatar name={client.name} size="sm" />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {client.name}
                          {client.requiresDeposit ? (
                            <span className="text-muted ml-2 text-xs font-normal">pede sinal</span>
                          ) : null}
                        </p>
                        <p className="text-muted tnum truncate text-sm">
                          {formatPhone(client.phone)}
                        </p>
                      </div>

                      <span className="text-muted shrink-0 text-right text-sm">
                        {client.lastVisitAt ? (
                          desdeAVisita(client.lastVisitAt)
                        ) : (
                          /* Cadastrada e nunca atendida é informação, não um
                             buraco: é exatamente quem vale uma ligação. */
                          <span className="text-(--accent)">ainda não veio</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
