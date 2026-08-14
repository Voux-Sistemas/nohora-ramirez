import { cn } from '@/lib/utils'

/**
 * A recusa de um formulário, dentro do formulário.
 *
 * Estava copiada em dez sítios, e a cópia trazia o defeito habitual da cópia:
 * sete tinham `role="alert"` e três não. Sem ele a mensagem aparece no ecrã e
 * não é anunciada — quem usa leitor de ecrã carrega em "Confirmar", não ouve
 * nada, e carrega outra vez. Aqui está uma vez só, e certo.
 *
 * Não leva `'use client'` de propósito: é só marcação, e há telas de servidor
 * (a remarcação) que mostram a mesma recusa vinda da query.
 */
export function Erro({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  if (!children) return null
  return (
    <p
      role="alert"
      className={cn(
        'rounded-plate border border-(--estado-mau)/40 bg-(--estado-mau)/8 p-3 text-sm text-(--estado-mau)',
        className,
      )}
    >
      {children}
    </p>
  )
}
