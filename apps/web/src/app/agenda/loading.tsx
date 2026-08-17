import { Barra } from '@/components/ui/esqueleto'

/**
 * A agenda é a tela mais pesada do sistema — dia inteiro, todas as colunas,
 * disponibilidade calculada — e é também a que mais se troca de data. Sem esta
 * tela a recepção clicava em "amanhã" e não via nada mudar por um segundo.
 *
 * O desenho é o próprio quadro, e são dois: a lista do telemóvel e a prancheta
 * de colunas do balcão, na mesma dobra em que a tela de verdade troca uma pela
 * outra. Um esqueleto de três colunas num telemóvel promete uma tela que não
 * vai chegar — e prometer errado é pior do que não desenhar nada.
 */
export default function CarregandoAgenda() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8">
      <span className="sr-only" role="status">
        A carregar a agenda…
      </span>

      <div aria-hidden>
        <div className="mb-5 flex flex-col gap-3">
          <Barra className="h-8 w-48" />
          <Barra className="h-4 w-56" />
          {/* a linha de comando do dia: setas, data, ir */}
          <Barra className="mt-1 h-11 w-full max-w-xs" />
        </div>

        {/* o dia como lista */}
        <div className="surface rounded-card flex flex-col divide-y divide-(--border-subtle) md:hidden">
          {[0, 1, 2, 3, 4, 5].map((linha) => (
            <div key={linha} className="flex min-h-17 items-center gap-3 py-2.5 pr-3 pl-1">
              <Barra className="h-8 w-10 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Barra className="h-4 w-2/5" />
                <Barra className="h-3 w-3/5" />
              </div>
            </div>
          ))}
        </div>

        {/* a prancheta de colunas */}
        <div className="hidden gap-3 md:flex">
          {/* régua de horas */}
          <div className="flex w-14 shrink-0 flex-col gap-6 pt-10">
            {Array.from({ length: 9 }, (_, i) => (
              <Barra key={i} className="h-3 w-9" />
            ))}
          </div>

          {/* colunas de profissionais */}
          {Array.from({ length: 3 }, (_, coluna) => (
            <div key={coluna} className="flex min-w-0 flex-1 flex-col gap-3">
              <Barra className="h-6 w-full" />
              <div className="flex flex-col gap-3">
                {/* alturas diferentes por coluna: agenda de verdade não é
                    tijolo igual, e um esqueleto quadriculado promete uma tela
                    que não vai chegar */}
                {[64, 112, 48, 96].map((altura, i) => (
                  <Barra key={i} style={{ height: `${altura + coluna * 12}px` }} className="w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
