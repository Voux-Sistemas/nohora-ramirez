import type { NextConfig } from 'next'

const config: NextConfig = {
  // os pacotes do monorepo são TypeScript cru; o Next compila junto
  transpilePackages: ['@studio/core', '@studio/db'],
  experimental: {
    /*
      Server Actions recebem FormData grande no import do onboarding e, agora,
      a foto da unidade junto com o cadastro. Tem de ficar acima do teto de 8 MB
      da imagem: se o limite fosse menor, o Next cortaria o corpo antes da nossa
      validação rodar e a recepção veria erro de framework em vez do recado.
    */
    serverActions: { bodySizeLimit: '12mb' },
  },
  typedRoutes: true,
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
