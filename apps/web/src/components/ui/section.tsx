import { cn } from '@/lib/utils'

/**
 * Cabeçalho de um bloco: título, régua de bronze e — quando faz sentido — o
 * atalho para o assunto inteiro, na mesma linha.
 *
 * Morava dentro da casca da gestão, mas nunca foi da gestão: é a marca de
 * secção do produto inteiro, a mesma régua que a cliente vê no passo dos
 * horários e na conta dela. O painel passou a usá-la, e um painel a importar
 * `@/components/admin/shell` era a dependência ao contrário.
 *
 * A `hint` continua a existir, mas passou a ser exceção. Uma frase explicativa
 * debaixo de cada bloco, em todas as telas, era metade da sensação de
 * "informação a mais": texto a competir com o número que a dona veio ler. Onde
 * o título já diz, o título basta.
 */
export function Section({
  title,
  hint,
  actions,
  className,
  children,
}: {
  title: string
  hint?: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    /* O respiro entre blocos vive aqui e não em cada tela — quem monta um
       bloco dentro de uma grelha, que já tem `gap`, passa `mb-0`. */
    <section className={cn('mb-9', className)}>
      <div className="flex items-baseline gap-4">
        <h2 className="shrink-0 text-base font-medium">{title}</h2>
        <span className="rule-bronze min-w-0 flex-1" aria-hidden />
        {actions ? <div className="shrink-0 text-sm">{actions}</div> : null}
      </div>
      {hint ? <p className="text-muted mt-2 text-sm">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  )
}
