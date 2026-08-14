import type { NextConfig } from 'next'

const config: NextConfig = {
  /*
    `PAIS` embutido no bundle do navegador também, não só no servidor: o campo
    de telefone precisa saber o formato do país para mascarar enquanto a
    cliente digita, e isso roda no cliente. `lib/pais.ts` lê `process.env.PAIS`
    sem saber se está em componente de servidor ou de cliente — esta linha é o
    que faz a leitura funcionar nos dois.
  */
  env: { PAIS: process.env.PAIS ?? '' },
  // os pacotes do monorepo são TypeScript cru; o Next compila junto
  transpilePackages: ['@studio/core', '@studio/db'],
  experimental: {
    /*
      Server Actions recebem FormData grande no import do onboarding, a foto da
      unidade junto com o cadastro e a galeria da loja em lote. Tem de ficar
      acima do teto de 8 MB da imagem: se o limite fosse menor, o Next cortaria
      o corpo antes da nossa validação rodar e a recepção veria erro de
      framework em vez do recado.

      24 MB é o lote da galeria — quatro ou cinco fotografias saídas de um
      telemóvel de uma vez. O campo avisa antes de enviar quando o lote passa
      disso, porque estourar aqui não devolve mensagem nenhuma: é o servidor a
      recusar o corpo, sem chegar ao nosso código.
    */
    serverActions: { bodySizeLimit: '24mb' },
  },
  typedRoutes: true,
  /*
    Cabeçalhos de segurança em todas as respostas. Não havia nenhum, e nenhum
    deles custa nada em runtime — é configuração, não código.

    Falta aqui a `Content-Security-Policy` que trava a origem dos scripts. Ela
    exige nonce por pedido, e nonce por pedido exige middleware, que no App
    Router desliga a cache estática de tudo o que passa por ele. É uma decisão
    de arquitetura com preço, não uma linha a acrescentar — está registada em
    `docs/ROADMAP.md` como pendente. O `frame-ancestors` abaixo, que é a parte
    da CSP que protege contra clickjacking, esse já vai.
  */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Ninguém embute este site num iframe para enganar a cliente a
          // clicar onde não vê. Vale nos dois vocabulários: o antigo, que o
          // Safari ainda prefere, e o da CSP, que é o que os outros leem.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          // O navegador respeita o `Content-Type` que mandamos em vez de
          // adivinhar pelo conteúdo — é o que impede uma fotografia enviada
          // pela recepção de ser servida como script.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // O link que a cliente clica para fora não leva o caminho completo
          // de onde ela estava. `/conta/marcacoes/<id>` não é da conta de
          // ninguém a não ser dela.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // O site não pede câmara, microfone nem localização em lado nenhum;
          // dizê-lo fecha a porta antes de alguém a abrir sem reparar.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Dois anos de HTTPS obrigatório. O Railway já serve só em TLS —
          // isto tira do caminho o primeiro pedido em claro, que é onde a
          // sessão da dona seria apanhada numa rede de café.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
  images: {
    /*
      As fotos do catálogo de demonstração são hospedadas fora. Quando o salão
      subir as próprias imagens, o host do storage entra aqui ao lado — a
      coluna guarda URL, então trocar de provedor é trocar esta lista, não o
      esquema. As fotos atuais são ilustrativas e estão na lista de reposição.
    */
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  webpack(config) {
    // os pacotes usam imports ESM com extensão (`./time/range.js`) apontando
    // para arquivos .ts — o webpack precisa saber fazer essa troca
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
    }
    return config
  },
}

export default config
