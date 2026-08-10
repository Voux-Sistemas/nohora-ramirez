import { NextResponse } from 'next/server'
import { extensionFor, imageStore, ACCEPTED_IMAGE_TYPES } from '@/server/storage'

/**
 * Leitura das imagens enviadas pelo salão, seja qual for o driver.
 *
 * Existe porque nenhum driver grava em `public/` (ver o porquê em
 * `server/storage/index.ts`). Ela não sabe se o arquivo veio de disco ou de
 * bucket — pede ao driver e repassa o fluxo. Foi o que permitiu trocar o disco
 * pelo bucket sem mudar a coluna `image_url` de uma única linha do banco: a URL
 * continua sendo esta rota, e as fotos gravadas antes da troca continuam
 * abrindo pelo mesmo endereço.
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

  /*
    O tipo sai da extensão que acabou de ser validada, nunca do que o driver
    devolve. Com bucket, o `Content-Type` do objeto vem de fora do processo —
    e o que nós servimos não deve depender disso.
  */
  const extension = key[key.length - 1]!.split('.')[1]
  const contentType = extension ? TYPE_BY_EXT.get(extension) : undefined
  if (!contentType) return new NextResponse(null, { status: 404 })

  const file = await imageStore().get(key.join('/'))
  if (!file) return new NextResponse(null, { status: 404 })

  return new NextResponse(file.body, {
    headers: {
      'Content-Type': contentType,
      ...(file.size === undefined ? {} : { 'Content-Length': String(file.size) }),
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
