import { redirect } from 'next/navigation'
import { podeRede, requireGestao } from '@/server/auth/permissoes'

/*
  O começo dos cadastros depende de quem entrou: a dona cai em Unidades, que é
  a primeira aba dela; o gerente cai em Equipe, porque Unidades é tela de rede e
  mandá-lo para lá só o devolveria daqui a um passo.
*/
export default async function AdminIndexPage() {
  const acesso = await requireGestao()
  redirect(podeRede(acesso) ? '/admin/unidades' : '/admin/equipe')
}
