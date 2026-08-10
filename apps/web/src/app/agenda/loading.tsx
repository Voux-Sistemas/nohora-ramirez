import { Barra } from '@/components/ui/esqueleto'

/**
 * A agenda é a tela mais pesada do sistema — dia inteiro, todas as colunas,
 * disponibilidade calculada — e é também a que mais se troca de data. Sem esta
 * tela a recepção clicava em "amanhã" e não via nada mudar por um segundo.
 *
 * O desenho é a própria grade: régua de horas à esquerda, colunas de gente à
 * direita. Assim a tela não pula de forma quando os dados chegam.
 */
export default function CarregandoAgenda() {
  return (
    <main aria-busy="true" className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <span className="sr-only" role="status">
        Carregando a agenda…
      </span>

      <div aria-hidden>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Barra className="h-8 w-48" />
            <Barra className="h-4 w-32" />
          </div>
          <Barra className="h-11 w-40" />
        </div>

        <div className="flex gap-3">
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
                  <Barra
                    key={i}
                    style={{ height: `${altura + coluna * 12}px` }}
                    className="w-full"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
