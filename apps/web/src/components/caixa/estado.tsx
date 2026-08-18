import { cn } from '@/lib/utils'

/**
 * Estado da gaveta, em forma antes de número: quem olha de longe já sabe.
 *
 * Saiu da tela do caixa para aqui quando passaram a ser duas as telas que o
 * dizem — a gaveta de uma loja e o painel das lojas todas. Um estado que se
 * desenha de duas maneiras é um estado que se lê devagar, e este lê-se de
 * relance, do outro lado do balcão.
 */
export function EstadoDoCaixa({ aberto, className }: { aberto: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
        aberto
          ? 'border-(--estado-bom)/30 text-(--estado-bom)'
          : 'border-(--border-subtle) text-(--text-muted)',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          aberto ? 'bg-(--estado-bom)' : 'bg-(--text-muted)',
        )}
      />
      {aberto ? 'Caixa aberto' : 'Caixa fechado'}
    </span>
  )
}
