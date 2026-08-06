import 'server-only'

/*
  Costura de storage.

  O salão vai subir foto da casa e foto de serviço, e onde esse arquivo mora é
  uma decisão de infraestrutura que ainda não foi tomada. Então o resto do
  produto não fala com disco nem com bucket: fala com `imageStore()`. Trocar
  disco local por S3/R2/Blob é escrever um driver novo aqui e mudar uma variável
  de ambiente — nenhuma tela, nenhuma action e nenhuma coluna mudam, porque o
  banco guarda URL, não caminho.

  O driver padrão é `local` de propósito: o produto precisa funcionar recém
  clonado, sem conta em lugar nenhum. Em produção com mais de uma instância,
  disco local não serve (cada máquina enxerga o seu) — daí a troca.
*/

/** O que o driver devolve depois de guardar. */
export interface StoredImage {
  /** URL pronta para `next/image` e para a coluna `image_url`. */
  url: string
  /** Identificador opaco do driver, para apagar depois. */
  key: string
}

export interface ImageStore {
  readonly name: string
  put(input: { key: string; body: Buffer; contentType: string }): Promise<StoredImage>
  remove(key: string): Promise<void>
}

/*
  Formatos que o navegador entrega de uma câmera de celular ou de um editor.
  Allowlist, não denylist: SVG fica de fora porque SVG é documento com script,
  e a foto do salão nunca precisa ser um.
*/
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

/** 8 MB: foto de celular moderna passa, vídeo renomeado e PSD não. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024

/*
  Assinatura real do arquivo, não o `type` que o navegador declarou. O campo
  `type` do FormData vem do cliente e é editável; os primeiros bytes não.
*/
export function sniffImageType(body: Buffer): string | null {
  if (body.length < 12) return null
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return 'image/jpeg'
  if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp'
  }
  if (body.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = body.subarray(8, 12).toString('ascii')
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
  }
  return null
}

export function extensionFor(contentType: string): string {
  return EXTENSIONS[contentType] ?? 'bin'
}

let cached: ImageStore | null = null

/**
 * O driver configurado. `IMAGE_STORE=local` (padrão) grava em disco e serve
 * por `/api/imagens`. Novos drivers entram no `switch`.
 */
export function imageStore(): ImageStore {
  if (cached) return cached
  const driver = process.env.IMAGE_STORE ?? 'local'
  switch (driver) {
    case 'local':
      cached = localStore()
      return cached
    default:
      throw new Error(
        `IMAGE_STORE="${driver}" desconhecido — drivers disponíveis: local. ` +
          'Um driver novo se implementa em apps/web/src/server/storage/.',
      )
  }
}

/*
  Driver de disco.

  Grava fora de `public/`: arquivo enviado por usuário não deve virar rota
  estática servida sem passar por código nosso, e `public/` é copiado no build,
  então o que a recepção subiu às três da tarde sumiria no próximo deploy.
  A leitura sai por `app/api/imagens/[...key]/route.ts`.
*/
function localStore(): ImageStore {
  return {
    name: 'local',
    async put({ key, body, contentType }) {
      const { writeFile, mkdir } = await import('node:fs/promises')
      const { dirname, join } = await import('node:path')
      const target = join(uploadRoot(), key)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, body)
      void contentType
      return { url: `/api/imagens/${key}`, key }
    },
    async remove(key) {
      const { unlink } = await import('node:fs/promises')
      const { join } = await import('node:path')
      // apagar é melhor esforço: se o arquivo já não está lá, o objetivo do
      // chamador (não existir mais) já foi atingido
      await unlink(join(uploadRoot(), key)).catch(() => {})
    },
  }
}

/** Raiz dos arquivos enviados. `UPLOAD_DIR` sobrescreve para outro volume. */
export function uploadRoot(): string {
  return process.env.UPLOAD_DIR ?? `${process.cwd()}/.uploads`
}
