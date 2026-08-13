import 'server-only'

import { Readable } from 'node:stream'

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

/** O que o driver devolve na leitura. `null` quando a chave não existe. */
export interface StoredFile {
  body: ReadableStream
  /** Tamanho em bytes, quando o driver sabe — vira `Content-Length`. */
  size?: number
}

export interface ImageStore {
  readonly name: string
  put(input: { key: string; body: Buffer; contentType: string }): Promise<StoredImage>
  /*
    A leitura passa pelo driver, e não pela rota, porque só o driver sabe onde o
    arquivo está. O tipo do conteúdo fica de fora de propósito: quem decide é a
    rota, a partir da extensão que ela mesma validou. Confiar no que o bucket
    devolve seria deixar o `Content-Type` do que servimos vir de fora.
  */
  get(key: string): Promise<StoredFile | null>
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
 * O driver configurado. `IMAGE_STORE=local` (padrão) grava em disco;
 * `IMAGE_STORE=s3` grava no bucket. Os dois servem por `/api/imagens`.
 */
export function imageStore(): ImageStore {
  if (cached) return cached
  const driver = process.env.IMAGE_STORE ?? 'local'
  switch (driver) {
    case 'local':
      cached = localStore()
      return cached
    case 's3':
      cached = s3Store()
      return cached
    default:
      throw new Error(
        `IMAGE_STORE="${driver}" desconhecido — drivers disponíveis: local, s3. ` +
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
    async get(key) {
      const { createReadStream } = await import('node:fs')
      const { stat } = await import('node:fs/promises')
      const { join, normalize, sep } = await import('node:path')

      /*
        Cinto e suspensório: a rota já recusa chave com `..` ou barra invertida,
        mas a garantia de não servir arquivo de fora da raiz mora aqui, junto do
        único código que abre arquivo. Guarda longe do que ela protege é guarda
        que some na próxima refatoração.
      */
      const root = normalize(uploadRoot())
      const file = normalize(join(root, key))
      if (file !== root && !file.startsWith(root + sep)) return null

      const info = await stat(file).catch(() => null)
      if (!info?.isFile()) return null

      return {
        body: Readable.toWeb(createReadStream(file)) as ReadableStream,
        size: info.size,
      }
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

/*
  Driver de bucket.

  É o driver de produção, e o motivo é backup: o volume de disco não entra no
  backup diário: o banco guardaria o endereço de uma foto que não existe mais.
  O bucket é o mesmo lugar para onde o dump do banco já vai todo dia.

  Bucket **separado** do `backups`, e isso não é organização — é segurança. A
  poda de retenção do `ops/backup/backup.sh` lista a raiz do bucket e apaga
  tudo que não está entre os 30 arquivos mais recentes. Foto de salão no mesmo
  bucket seria apagada pelo próprio backup, em silêncio, no trigésimo primeiro
  dia.

  A URL continua sendo `/api/imagens/<chave>`: quem serve é a nossa rota, que
  lê pelo driver. Assim a coluna `image_url` não muda de formato, as fotos já
  gravadas continuam abrindo, e o controle de quem lê o quê continua nosso.
*/
function s3Store(): ImageStore {
  const bucket = exigir('S3_BUCKET')
  const endpoint = exigir('S3_ENDPOINT')
  const credentials = {
    accessKeyId: exigir('S3_ACCESS_KEY_ID'),
    secretAccessKey: exigir('S3_SECRET_ACCESS_KEY'),
    region: process.env.S3_REGION || 'auto',
  }

  /* Estilo de subdomínio: o bucket vira host. É o que o endpoint da Railway
     espera — no formato antigo, de caminho, ele não acha o bucket. */
  const base = new URL(endpoint)
  base.host = `${bucket}.${base.host}`

  /* Montada à mão, não com `new URL(key, base)`: resolução relativa mudaria de
     resultado se o endpoint um dia vier com caminho. */
  const enderecoDe = (key: string) =>
    `${base.origin}/${key.split('/').map(encodeURIComponent).join('/')}`

  return {
    name: 's3',
    async put({ key, body, contentType }) {
      const { sha256Hex, signRequest } = await import('@studio/core/s3')
      const hash = sha256Hex(body)
      const assinada = signRequest({
        method: 'PUT',
        url: enderecoDe(key),
        payloadHash: hash,
        headers: { 'content-type': contentType, 'x-amz-content-sha256': hash },
        credentials,
      })

      const resposta = await fetch(assinada.url, {
        method: 'PUT',
        headers: assinada.headers,
        body: new Uint8Array(body),
      })

      /*
        Estourar aqui é de propósito. Upload que falha em silêncio grava a URL
        no banco e a foto quebrada só aparece semanas depois, para a cliente.
      */
      if (!resposta.ok) {
        throw new Error(`bucket recusou o upload de ${key}: ${resposta.status}`)
      }
      return { url: `/api/imagens/${key}`, key }
    },
    async get(key) {
      const { EMPTY_SHA256, signRequest } = await import('@studio/core/s3')
      const assinada = signRequest({
        method: 'GET',
        url: enderecoDe(key),
        payloadHash: EMPTY_SHA256,
        headers: { 'x-amz-content-sha256': EMPTY_SHA256 },
        credentials,
      })

      const resposta = await fetch(assinada.url, { headers: assinada.headers })
      if (!resposta.ok || !resposta.body) return null

      const tamanho = Number(resposta.headers.get('content-length'))
      return {
        body: resposta.body,
        size: Number.isFinite(tamanho) && tamanho > 0 ? tamanho : undefined,
      }
    },
    async remove(key) {
      const { EMPTY_SHA256, signRequest } = await import('@studio/core/s3')
      const assinada = signRequest({
        method: 'DELETE',
        url: enderecoDe(key),
        payloadHash: EMPTY_SHA256,
        headers: { 'x-amz-content-sha256': EMPTY_SHA256 },
        credentials,
      })

      // melhor esforço, igual ao driver local: o objetivo é não existir mais
      await fetch(assinada.url, { method: 'DELETE', headers: assinada.headers }).catch(() => {})
    },
  }
}

/*
  Falta de credencial derruba na primeira foto, não no start. Preferimos o erro
  com nome da variável a um driver que sobe e grava em lugar nenhum.
*/
function exigir(nome: string): string {
  const valor = process.env[nome]
  if (!valor) {
    throw new Error(`IMAGE_STORE=s3 exige ${nome} — ver ops/README.md, "Onde as fotos ficam".`)
  }
  return valor
}
