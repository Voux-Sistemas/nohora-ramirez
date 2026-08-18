import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

/*
  As lojas vêm do banco, portanto isto não é um ficheiro estático: abrir uma
  unidade nova no painel tem de a pôr no mapa sem ninguém tocar em código.
*/
export const dynamic = 'force-dynamic'

/**
 * O mapa das páginas que uma cliente pode encontrar na busca.
 *
 * São dois endereços por loja, e mais nenhum: o catálogo dessa casa e a montra
 * dessa casa, além das duas telas que existem sobre as duas — o painel das casas
 * e a escolha de casa da marcação. Tudo o resto do site ou exige sessão, ou
 * é um passo a meio de uma marcação — `/agendar/valongo/horarios` sem serviços
 * escolhidos devolve a pessoa ao princípio, e um resultado de busca que faz
 * isso é um resultado que não serve.
 *
 * `changeFrequency` e `priority` são pistas, não ordens, e é por isso que só
 * dizem a hierarquia real: a marcação vale mais do que a montra.
 *
 * Se o banco não responder, o mapa sai com as duas telas de rede e mais nada, em
 * vez de sair com erro 500: meio mapa vale mais do que um sitemap que o Google
 * marca como partido e deixa de pedir.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const url = (caminho: string) => new URL(caminho, base).toString()

  const raiz: MetadataRoute.Sitemap = [
    { url: url('/agendar'), changeFrequency: 'weekly', priority: 1 },
    /* O painel das casas é o endereço da bio do Instagram: é montra, não funil,
       e por isso vale menos que a marcação e mais que a montra de uma casa só. */
    { url: url('/loja'), changeFrequency: 'monthly', priority: 0.8 },
  ]

  let unidades: { slug: string }[]
  try {
    /*
      Importado aqui dentro, e não no topo, porque `@/lib/db` abre a ligação no
      corpo do módulo: importá-la lá em cima faz o `next build` rebentar em
      "Collecting page data" numa máquina sem DATABASE_URL, e o compilar deixa
      de ser possível sem banco à mão. As páginas normais escapam por serem
      dinâmicas; uma rota de metadados como esta é sempre avaliada. Já rebentou
      uma vez — o import ficou preguiçoso de propósito.
    */
    const { listUnits } = await import('@/server/scheduling/context')
    unidades = await listUnits()
  } catch (e) {
    console.error('[sitemap] não foi possível listar as unidades', e)
    return raiz
  }

  return [
    ...raiz,
    ...unidades.flatMap((unidade) => [
      {
        url: url(`/agendar/${unidade.slug}`),
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      },
      {
        url: url(`/loja/${unidade.slug}`),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      },
    ]),
  ]
}
