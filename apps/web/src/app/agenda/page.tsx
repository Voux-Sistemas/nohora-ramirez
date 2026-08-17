import { redirect } from 'next/navigation'
import { SemLoja } from '@/components/operate/sem-loja'
import { requireAcesso, unidadesVisiveis } from '@/server/auth/permissoes'
import { listUnits } from '@/server/scheduling/context'

export const dynamic = 'force-dynamic'

/**
 * `/agenda` sem loja já não pergunta: leva.
 *
 * Aqui vivia "de que loja quer ver o dia?" — um ecrã inteiro, com a fotografia
 * de cada sala, para uma pergunta que a barra de cima passou a responder
 * sozinha. Quem vem de `/caixa/valongo` e carrega em Agenda nem chega a este
 * endereço: vai direto para `/agenda/valongo`, porque a loja segue a pessoa.
 * Quem cai aqui é quem entrou pela raiz, e para esse a resposta certa é a
 * primeira loja que lhe cabe — trocar é um gesto no seletor da barra, no mesmo
 * sítio, sem sair da tela.
 */
export default async function AgendaIndexPage() {
  const acesso = await requireAcesso()
  const unidades = unidadesVisiveis(acesso, await listUnits())
  if (unidades.length > 0) redirect(`/agenda/${unidades[0]!.slug}`)

  return <SemLoja titulo="Agenda do dia" />
}
