import { Barra } from '@/components/ui/esqueleto'

/* O caixa é coluna estreita e uma pilha de lançamentos — não é a pauta larga
   das outras telas, então tem esqueleto próprio. */
export default function CarregandoCaixa() {
  return (
    <div aria-busy="true" className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <span className="sr-only" role="status">
        Carregando o caixa…
      </span>
      <div aria-hidden className="flex flex-col gap-3">
        <Barra className="h-8 w-44" />
        <Barra className="h-4 w-28" />
        <Barra className="mt-4 h-24 w-full" />
        <div className="mt-2 flex flex-col">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 border-b border-(--border-subtle) py-4">
              <Barra className="h-4 w-44 max-w-[55%]" />
              <Barra className="h-4 w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
