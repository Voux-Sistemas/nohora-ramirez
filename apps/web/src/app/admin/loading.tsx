import { Barra, Carregando, PautaFalsa } from '@/components/ui/esqueleto'

/**
 * A espera da gestão inteira — este ficheiro serve `/admin` e todas as telas
 * abaixo que não trouxerem esqueleto próprio.
 *
 * A operação já tinha o dela (agenda, avisos, caixa, clientes) e a gestão não:
 * ao trocar de secção no rail a tela ficava congelada na anterior enquanto o
 * servidor somava o mês, e o clique parecia não ter pegado. É o mesmo problema
 * que o esqueleto da operação resolveu, na área onde as consultas são as mais
 * pesadas do sistema.
 *
 * O desenho copia a moldura de `AdminShell` de propósito — 90rem, rail à
 * esquerda a partir de `lg`, cabeçalho e depois a matéria. Um esqueleto que não
 * ocupa o sítio do conteúdo faz a página saltar quando ele chega, que é
 * exatamente o que ele existe para evitar.
 */
export default function CarregandoGestao() {
  return (
    <Carregando className="mx-auto w-full max-w-[90rem]">
      <div className="flex">
        <div className="hidden shrink-0 border-r border-(--border-subtle) lg:block lg:w-48 xl:w-56">
          <div className="flex flex-col gap-3 py-9 pr-5 pl-5">
            <Barra className="h-4 w-20" />
            <Barra className="h-4 w-24" />
            <Barra className="h-4 w-16" />
            <Barra className="mt-4 h-4 w-20" />
            <Barra className="h-4 w-24" />
          </div>
        </div>

        <div className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-9 xl:px-10">
          <div className="mb-7 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Barra className="h-8 w-48" />
            <Barra className="h-4 w-32" />
          </div>
          <PautaFalsa linhas={7} />
        </div>
      </div>
    </Carregando>
  )
}
