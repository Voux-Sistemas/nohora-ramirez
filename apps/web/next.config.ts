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
    Os endereços antigos.

    A reorganização juntou oito entradas de topo em duas áreas — a da cliente
    (`/`, `/casa`, `/marcar`, `/minha-conta`) e a da equipa (`/painel/…`). Só
    que o link de `/loja/valongo` está na bio do Instagram e em conversas de
    WhatsApp que não podemos reescrever, e a equipa tem `/agenda` guardado nos
    favoritos do tablet.

    São 308 (permanente) para os endereços públicos, que interessam ao
    indexador, e 307 (temporário) para os do painel — o caminho da equipa ainda
    pode mexer-se enquanto o sistema assenta, e um permanente fica preso no
    navegador de quem o abriu uma vez.
  */
  async redirects() {
    return [
      { source: '/loja', destination: '/', permanent: true },
      { source: '/loja/:slug', destination: '/casa/:slug', permanent: true },
      { source: '/agendar', destination: '/marcar', permanent: true },
      { source: '/agendar/:slug', destination: '/marcar?casa=:slug', permanent: true },
      { source: '/agendar/:slug/:rest*', destination: '/marcar?casa=:slug', permanent: true },
      { source: '/conta', destination: '/minha-conta', permanent: true },
      { source: '/conta/entrar', destination: '/entrar', permanent: true },
      { source: '/conta/verificar', destination: '/entrar/codigo', permanent: true },

      { source: '/agenda', destination: '/painel', permanent: false },
      { source: '/agenda/:slug', destination: '/painel', permanent: false },
      { source: '/caixa', destination: '/painel/caixa', permanent: false },
      { source: '/caixa/:slug', destination: '/painel/caixa', permanent: false },
      { source: '/clientes', destination: '/painel/clientes', permanent: false },
      { source: '/clientes/:id', destination: '/painel/clientes/:id', permanent: false },
      { source: '/avisos', destination: '/painel/avisos', permanent: false },
      { source: '/avisos/:slug', destination: '/painel/avisos', permanent: false },
      { source: '/admin', destination: '/painel/gestao', permanent: false },
      { source: '/admin/:rest*', destination: '/painel/gestao/:rest*', permanent: false },
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
