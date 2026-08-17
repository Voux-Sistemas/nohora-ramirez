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
      /*
        `/agenda/` leva barra no fim e isso não é estilo — é a diferença entre
        ter o salão no Google e não ter. As regras deste ficheiro casam por
        prefixo de texto puro, sem noção de segmento: `Disallow: /agenda`
        apanharia `/agendar`, `/agendar/valongo` e o funil inteiro de marcação,
        que é precisamente a página que tem de aparecer quando alguém procura o
        nome do salão. E o desempate entre uma regra que proíbe e uma que
        permite é pelo padrão mais comprido, portanto o `Allow: /` de cima não
        salvava nada. Com a barra, `/agendar` deixa de casar — depois de
        `/agenda` vem um `r`, não uma barra.

        O `/agendar` explícito abaixo é redundante e fica: quem mexer nesta
        lista amanhã vê declarado que aquela porta é para estar aberta.
      */
      allow: ['/', '/agendar'],
      disallow: [
        '/admin',
        '/agenda/',
        '/caixa',
        '/clientes',
        '/avisos',
        '/conta',
        '/comecar',
        '/entrar',
        '/api',
      ],
    },
    sitemap: new URL('/sitemap.xml', base).toString(),
  }
}
