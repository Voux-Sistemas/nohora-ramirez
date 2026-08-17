import { cn } from '@/lib/utils'

/**
 * A barra de ação encostada ao fundo do ecrã.
 *
 * É onde vive a ação principal de um passo — «Ver horários», «Confirmar» — e
 * existe porque a decisão está no polegar: a lista de serviços do Valongo tem
 * sessenta e sete linhas, e um botão no fim dela seria um botão que a cliente
 * tem de procurar. Aqui ele está sempre onde o dedo já está.
 *
 * Havia duas cópias disto, uma na casca do agendamento e outra dentro da
 * escolha de serviços, com as mesmas seis classes escritas à mão. Só uma delas
 * respeitava o `env(safe-area-inset-bottom)` — no iPhone a outra nascia por
 * baixo da risca de gestos do sistema, com o preço da marcação cortado ao meio.
 * Uma definição, um comportamento.
 *
 * `Espaco` é o par obrigatório: a barra é fixa, portanto sai do fluxo, e sem
 * reservar a altura dela o último serviço da lista fica escondido por baixo.
 * Quem põe a barra reserva o espaço — não é trabalho de quem chama de fora.
 */
export function BarraDeAcao({
  largura,
  className,
  children,
}: {
  /** Classe de largura da coluna sob a barra, para o conteúdo alinhar com ela. */
  largura: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-(--border-subtle) bg-(--surface-raised)/95 shadow-(--shadow-lift) backdrop-blur-md',
        className,
      )}
    >
      {/* `env(safe-area-inset-bottom)`: no iPhone a barra encostada em
          `bottom-0` nasce debaixo da barra de gestos, e o que estiver na linha
          de baixo fica cortado pela risca branca do sistema. */}
      {/* A barra é a chapa; quem a chama arruma o que põe lá dentro. Impor uma
          fila aqui partia o `justify-between` do resumo dos horários. */}
      <div
        className={cn(
          'mx-auto w-full px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8',
          largura,
        )}
      >
        {children}
      </div>
    </div>
  )
}

/** O buraco que a barra deixa no fluxo. Vai no fim do conteúdo que ela cobre. */
export function EspacoDaBarra() {
  return <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" />
}
