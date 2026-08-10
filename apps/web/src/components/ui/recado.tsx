/**
 * A tela de recado: 404, erro, ou qualquer beco sem saída.
 *
 * Existe para que o beco tenha o mesmo mundo do resto — travertino, Bodoni,
 * régua de bronze. A página de erro padrão do framework é onde todo produto
 * bonito revela que é um site; aqui ela é só mais uma tela do salão.
 *
 * A regra das três: um título, uma frase, uma saída. Beco com três botões é
 * beco que não sabe para onde mandar quem chegou.
 */
export function Recado({
  titulo,
  children,
  acoes,
  nota,
}: {
  titulo: string
  children: React.ReactNode
  acoes?: React.ReactNode
  nota?: string
}) {
  return (
    <main className="mx-auto flex min-h-[80dvh] w-full max-w-md flex-col justify-center px-5 py-12">
      <h1 className="display display-md text-(--text-strong)">{titulo}</h1>
      <div className="rule-bronze mt-4 w-16" />
      <div className="text-body mt-5 text-[0.9375rem] leading-relaxed">{children}</div>
      {acoes ? <div className="mt-7 flex flex-wrap items-center gap-3">{acoes}</div> : null}
      {/* O código do erro fica pequeno e no rodapé: quem não precisa dele nem
          vê, e quem for procurar no log tem o que digitar. */}
      {nota ? <p className="text-muted mt-8 text-xs">{nota}</p> : null}
    </main>
  )
}
