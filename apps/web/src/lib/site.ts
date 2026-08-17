/**
 * O endereço público desta instalação.
 *
 * Quase toda a aplicação vive de caminhos relativos e nunca precisa de saber
 * onde está hospedada. Três coisas precisam, e nenhuma delas tem um pedido HTTP
 * à mão de onde tirar o domínio: o `robots.txt`, o `sitemap.xml` e o cartão que
 * o WhatsApp, o Instagram e o Google desenham quando alguém partilha o link da
 * marcação. Esses três são gerados fora de um pedido, e um URL relativo lá
 * dentro não significa nada.
 *
 * `SITE_URL` é a resposta definitiva e é a única linha que muda no dia em que o
 * domínio do salão entrar — o `sitemap`, o `robots` e o cartão de partilha
 * seguem-na sozinhos. Enquanto o domínio não chega, a Railway publica o dela em
 * `RAILWAY_PUBLIC_DOMAIN` (sem esquema, só o anfitrião), e é ela que segura a
 * demonstração. Em último caso fica o localhost do `npm run dev`.
 *
 * Devolve `URL` e não `string` de propósito: é isso que o `metadataBase` do
 * Next quer, e a construção rebenta aqui, no arranque, se alguém escrever um
 * endereço torto na variável — em vez de sair um sitemap com URLs inválidos que
 * ninguém repara durante meses.
 */
export function siteUrl(): URL {
  const declarado = process.env.SITE_URL?.trim()
  if (declarado) return new URL(declarado)

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim()
  if (railway) return new URL(`https://${railway}`)

  return new URL('http://localhost:3000')
}
