import { redirect } from 'next/navigation'
import { podeRede, requireGestao } from '@/server/auth/permissoes'

/**
 * `/admin` deixou de ser tela e passou a ser porta.
 *
 * Aqui vivia o painel do mês, e era o painel a mais: a dona tinha um em `/` —
 * a pauta do dia, com uma placa do mês ao lado e um "ver painel completo →" a
 * apontar para cá — e outro aqui, a responder à mesma pergunta com mais casas
 * decimais. Duas telas para "como vai o negócio", cada uma com metade da
 * resposta, e a barra de cima a chamar "Gestão" ao que era um relatório.
 *
 * O mês mudou-se para `/`, inteiro. O que "Gestão" quer dizer é cadastro, e
 * cadastro é o rail — que já lista tudo o que há para gerir. Um índice a
 * repetir o rail seria um menu para chegar a um menu, então quem clica em
 * Gestão aterra directamente na primeira área que lhe cabe: a dona nas
 * unidades, o gerente na equipa dele (as áreas da rede nem sequer lhe
 * aparecem, e mandá-lo para lá era mandá-lo para um redirecionamento).
 */
export default async function GestaoPage() {
  const acesso = await requireGestao()
  redirect(podeRede(acesso) ? '/admin/unidades' : '/admin/equipe')
}
