import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

/**
 * O que os motores de busca podem ler.
 *
 * Não é segurança — quem quiser entrar em `/admin` continua a bater na porta de
 * `/entrar`, e é essa porta que decide. Isto é sobre o que aparece no Google
 * quando alguém escreve o nome do salão: a resposta certa é a página de
 * marcação e a montra das duas lojas, e nunca o painel da recepção, o caixa ou
 * a área da cliente.
 *
 * O motivo de as fechar não é o segredo, é a experiência: essas telas respondem
 * a quem não tem sessão com um desvio para `/entrar`, e uma pessoa que as
 * encontrasse na busca aterrava num formulário de palavra-passe em vez de num
 * botão de marcar. O rastreador também não deve gastar o orçamento de leitura
 * do salão em telas que, para ele, são todas a mesma.
 *
 * `/api` fica de fora porque nada lá é uma página — e `/api/imagens` serve as
 * fotografias das lojas, que já entram no índice pela página que as mostra.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/agenda', '/caixa', '/clientes', '/avisos', '/conta', '/comecar', '/entrar', '/api'],
    },
    sitemap: new URL('/sitemap.xml', base).toString(),
  }
}
