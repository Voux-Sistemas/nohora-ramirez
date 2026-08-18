import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * `/marcar` — o link curto que vai no Instagram.
 *
 * Não é uma tela; é a palavra que uma pessoa de cá escreve quando quer marcar.
 * O funil chama-se `/agendar` porque foi assim que o código o chamou, e mudar
 * agora partia todos os links já partilhados. Este endereço existe para o
 * cartaz, para a bio e para a mensagem escrita à pressa — e reencaminha.
 *
 * Fica de fora do sitemap de propósito: é um atalho para uma página que já lá
 * está, e duas entradas para o mesmo destino é o que faz um motor de busca
 * escolher qual delas mostrar.
 */
export default function Marcar() {
  redirect('/agendar')
}
