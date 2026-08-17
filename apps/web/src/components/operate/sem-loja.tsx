/**
 * O que resta de "escolha a loja" quando não há loja nenhuma para escolher.
 *
 * As três secções por loja — agenda, avisos, caixa — abriam numa tela
 * intermédia a perguntar qual. Essa tela desapareceu: a loja segue a pessoa na
 * barra, e quem chega ao endereço sem loja é levado direto para a primeira que
 * lhe cabe. Sobra este caso, que não é escolha nenhuma — ninguém lhe atribuiu
 * loja — e que precisa de dizer isso em vez de mostrar uma lista vazia.
 */
export function SemLoja({ titulo }: { titulo: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="display text-[1.75rem] leading-[1.1] font-normal sm:text-[2rem]">{titulo}</h1>
      <p className="plate text-muted mt-6 px-6 py-10 text-center text-sm">
        Nenhuma loja atribuída a si ainda. Fale com a administração.
      </p>
    </main>
  )
}
