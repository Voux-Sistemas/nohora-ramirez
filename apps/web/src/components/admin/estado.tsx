import { cn } from '@/lib/utils'

/**
 * Ativo/inativo deixa de ser só uma palavra colorida — o ponto carrega o
 * estado mesmo para quem lê rápido ou não distingue bem a cor, e os tokens já
 * valem nos dois temas. "Inativo" fica neutro (cinza), não vermelho: não é um
 * erro, é uma escolha de quem cadastrou.
 */
export function Estado({
  ativo,
  ligado = 'ativo',
  desligado = 'inativo',
}: {
  ativo: boolean
  ligado?: string
  desligado?: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.9375rem]">
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          ativo ? 'bg-(--estado-bom)' : 'bg-(--border-strong)',
        )}
      />
      <span className={ativo ? 'text-(--text-strong)' : 'text-muted'}>{ativo ? ligado : desligado}</span>
    </span>
  )
}
