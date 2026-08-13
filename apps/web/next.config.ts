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
