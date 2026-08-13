import 'server-only'

/**
 * O contexto do painel: quem é, que casas vê, e em qual está a trabalhar.
 *
 * ── Por que este arquivo existe ───────────────────────────────────────────
 * O painel tinha a unidade no caminho de cada rota: `/agenda/[unidade]`,
 * `/caixa/[unidade]`, `/avisos/[unidade]`. Consequência: cada secção tinha
 * uma tela-índice só para escolher a loja outra vez, e trocar de secção
 * perdia a escolha — a recepção saía da agenda do Valongo e caía no índice
 * do caixa, sem loja nenhuma. Eram três telas de escolha para uma decisão
 * que se toma uma vez por turno.
 *
 * Agora a casa é estado do painel, não do endereço: mora num cookie, escolhe-se
 * uma vez na barra e vale para agenda, caixa, clientes e avisos. As rotas
 * ficaram planas (`/painel/caixa`), e a permissão continua a ser verificada
 * aqui a cada leitura — cookie é preferência, nunca autorização.
 */

import { cookies } from 'next/headers'
import { listUnits, type UnitInfo } from '@/server/scheduling/context'
import { requireAcesso, unidadesVisiveis, type Acesso } from '@/server/auth/permissoes'

const COOKIE_UNIDADE = 'unidade'

export interface ContextoPainel {
  acesso: Acesso
  /** Só as casas que esta pessoa pode ver. Nunca a rede inteira por engano. */
  unidades: UnitInfo[]
  /**
   * A casa activa. `null` só quando a pessoa não tem casa nenhuma atribuída —
   * um estado real (profissional recém-cadastrada) que as telas tratam.
   */
  unidade: UnitInfo | null
}

/**
 * Resolve o contexto do painel para a requisição actual.
 *
 * O cookie é uma sugestão: se apontar para uma loja que a pessoa não vê — ela
 * mudou de função, o gerente perdeu uma unidade, alguém copiou o cookie — cai
 * silenciosamente na primeira visível. Recusar com erro seria punir a pessoa
 * por um estado que ela não criou.
 */
export async function contextoDoPainel(): Promise<ContextoPainel> {
  const acesso = await requireAcesso()
  const todas = await listUnits()
  const unidades = unidadesVisiveis(acesso, todas)

  const store = await cookies()
  const escolhida = store.get(COOKIE_UNIDADE)?.value
  const unidade =
    unidades.find((item) => item.slug === escolhida) ?? unidades[0] ?? null

  return { acesso, unidades, unidade }
}

/**
 * Como acima, mas exige uma casa. As telas de operação — agenda, caixa,
 * avisos — não têm o que mostrar sem uma.
 */
export async function exigeUnidade(): Promise<ContextoPainel & { unidade: UnitInfo }> {
  const contexto = await contextoDoPainel()
  if (!contexto.unidade) {
    /* Não é `notFound`: a pessoa entrou legitimamente e o sistema é que está
       incompleto. A tela que apanha isto explica o que falta e a quem pedir. */
    throw new SemUnidade()
  }
  return { ...contexto, unidade: contexto.unidade }
}

export class SemUnidade extends Error {
  constructor() {
    super('Nenhuma casa atribuída a esta conta.')
    this.name = 'SemUnidade'
  }
}

export const NOME_COOKIE_UNIDADE = COOKIE_UNIDADE
