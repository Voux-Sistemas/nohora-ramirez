import { redirect } from 'next/navigation'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * `/loja` sem nome de loja.
 *
 * Não é uma tela — é o endereço que alguém escreve à mão, ou que sobra quando um
 * link antigo perde o último pedaço. Com uma casa só, leva direto a ela. Com
 * mais, leva ao díptico, que já é a tela que existe para escolher entre casas;
 * uma segunda tela de escolha diria exactamente a mesma coisa com outra
 * fotografia.
 */
export default async function LojaSemNome() {
  const units = await listUnits()
  // `as never`: o slug só existe em tempo de execução e `typedRoutes` quer literal
  if (units.length === 1) redirect(`/loja/${units[0]!.slug}` as never)
  redirect('/agendar')
}
