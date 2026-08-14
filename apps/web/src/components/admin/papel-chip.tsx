import type { PapelEquipe } from '@/server/admin/staff'

const PAPEL_LABEL: Record<PapelEquipe, string> = {
  profissional: 'Profissional',
  gerente: 'Gerente',
  dona: 'Dona',
}

/**
 * Rótulo humano do degrau de acesso — a lista de equipe imprimia o slug cru
 * (`profissional`), que não é o vocabulário de ninguém fora do banco. Discreto
 * de propósito: não é um estado nem uma ação, é um fato do cadastro.
 */
export function PapelChip({ papel }: { papel: PapelEquipe }) {
  return (
    <span className="border-(--border-subtle) text-muted inline-block rounded-full border px-2 py-0.5 text-xs whitespace-nowrap">
      {PAPEL_LABEL[papel]}
    </span>
  )
}
