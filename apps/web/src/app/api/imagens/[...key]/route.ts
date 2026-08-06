import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { join, normalize, sep } from 'node:path'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { extensionFor, uploadRoot, ACCEPTED_IMAGE_TYPES } from '@/server/storage'

/**
 * Leitura dos arquivos do driver `local`.
 *
 * Existe porque o driver não grava em `public/` (ver o porquê em
 * `server/storage/index.ts`). Com um driver de bucket esta rota fica sem uso: a
 * URL passa a apontar para o CDN e o navegador nunca chega aqui.
 */

const TYPE_BY_EXT = new Map(ACCEPTED_IMAGE_TYPES.map((t) => [extensionFor(t), t]))

/*
  Só minúsculas, dígitos, hífen e um ponto de extensão. `..` não casa, `/` não
  casa (cada segmento vem separado), e nome com espaço ou acento também não —
  as chaves são geradas por nós, então qualquer coisa fora disso é sinal de que
  a URL foi montada à mão.
*/
const SEGMENT = /^[a-z0-9][a-z0-9-]*(\.[a-z0-9]+)?$/

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params
  if (key.length === 0 || key.length > 4 || !key.every((s) => SEGMENT.test(s))) {
    return new NextResponse(null, { status: 404 })
  }

  const extension = key[key.length - 1]!.split('.')[1]
  const contentType = extension ? TYPE_BY_EXT.get(extension) : undefined
  if (!contentType) return new NextResponse(null, { status: 404 })

  const root = normalize(uploadRoot())
  const file = normalize(join(root, ...key))
  // cinto e suspensório: mesmo com o regex acima, nada é servido de fora da raiz
  if (file !== root && !file.startsWith(root + sep)) {
    return new NextResponse(null, { status: 404 })
  }

  const info = await stat(file).catch(() => null)
  if (!info?.isFile()) return new NextResponse(null, { status: 404 })

  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream
  return new NextResponse(stream, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(info.size),
      /*
        Imutável: a chave carrega um sufixo aleatório, então trocar a foto gera
        uma URL nova. Cachear para sempre é seguro e tira a rota do caminho
        quente — quem serve a segunda visita é o navegador.
      */
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
