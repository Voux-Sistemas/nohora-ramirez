/**
 * Assinatura AWS SigV4.
 *
 * Existe para o driver de bucket guardar as fotos do salão sem trazer o SDK da
 * AWS junto. O SDK resolve dezenas de operações e nós usamos três — PUT, GET e
 * DELETE de um objeto —, então o que ele traria de útil é exatamente isto aqui:
 * o cálculo da assinatura. O resto seria peso no bundle e uma dependência a
 * mais para acompanhar.
 *
 * O módulo é puro de propósito: entra requisição e credencial, sai cabeçalho.
 * Não abre conexão, não lê variável de ambiente e não conhece bucket. É o que
 * permite conferir o resultado contra os vetores oficiais da AWS no teste ao
 * lado, que é a única forma honesta de saber que uma assinatura está certa.
 *
 * Não é reexportado pelo `index.ts` do pacote: ele usa `node:crypto`, e o
 * `index.ts` é importado por componente de tela. Quem precisa importa
 * `@studio/core/s3`.
 */

import { createHash, createHmac } from 'node:crypto'

/** SHA-256 de corpo vazio — o payload de todo GET e DELETE. */
export const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export interface Credentials {
  accessKeyId: string
  secretAccessKey: string
  region: string
}

export interface SignInput {
  method: string
  /** URL completa, no formato de subdomínio (`https://bucket.endpoint/chave`). */
  url: string
  /** SHA-256 do corpo, em hexadecimal. `EMPTY_SHA256` quando não há corpo. */
  payloadHash: string
  /** Cabeçalhos extras que entram na assinatura (`content-type`, por exemplo). */
  headers?: Record<string, string>
  /** `s3` na prática. É parâmetro para os vetores de teste da AWS entrarem. */
  service?: string
  credentials: Credentials
  /** Injetável para o teste ser determinístico. */
  now?: Date
}

/** Hexadecimal do SHA-256 — o corpo de um PUT passa por aqui antes de subir. */
export function sha256Hex(body: Buffer | string): string {
  return createHash('sha256').update(body).digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

/*
  RFC 3986. `encodeURIComponent` deixa passar cinco caracteres que a AWS espera
  codificados, e a barra fica de fora porque separa segmento — ela é estrutura
  do caminho, não conteúdo dele.
*/
function encodeSegment(segment: string): string {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function canonicalUri(pathname: string): string {
  if (pathname === '' || pathname === '/') return '/'
  return pathname.split('/').map(encodeSegment).join('/')
}

/*
  Ordem alfabética por chave, e valor codificado. Sem parâmetro nenhum sai
  string vazia, que é o caso das três operações que usamos.
*/
function canonicalQuery(url: URL): string {
  const pairs: [string, string][] = []
  url.searchParams.forEach((value, key) => pairs.push([key, value]))
  pairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
  return pairs.map(([k, v]) => `${encodeSegment(k)}=${encodeSegment(v)}`).join('&')
}

export interface SignedRequest {
  method: string
  url: string
  /** Prontos para `fetch`: os que entraram na assinatura mais o `Authorization`. */
  headers: Record<string, string>
}

/**
 * Devolve a requisição com `Authorization`, `x-amz-date` e `host` prontos.
 *
 * O relógio importa: a AWS recusa assinatura com mais de 15 minutos de
 * diferença. Se um PUT começar a falhar com 403 sem nada ter mudado, a hora do
 * container é o primeiro lugar para olhar.
 */
export function signRequest(input: SignInput): SignedRequest {
  const url = new URL(input.url)
  const service = input.service ?? 's3'
  const { accessKeyId, secretAccessKey, region } = input.credentials

  /* `20260810T194153Z` — ISO sem hífen, sem dois-pontos e sem milissegundo. */
  const amzDate = (input.now ?? new Date())
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
  const dateStamp = amzDate.slice(0, 8)

  /*
    Nomes em minúscula porque a assinatura é sensível a caixa e o cabeçalho HTTP
    não é. Assinar `Content-Type` e mandar `content-type` dá 403.
  */
  const headers: Record<string, string> = { host: url.host, 'x-amz-date': amzDate }
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    headers[name.toLowerCase()] = value
  }

  const names = Object.keys(headers).sort()
  const canonicalHeaders = names
    .map((name) => `${name}:${headers[name]!.trim().replace(/\s+/g, ' ')}\n`)
    .join('')
  const signedHeaders = names.join(';')

  const canonicalRequest = [
    input.method.toUpperCase(),
    canonicalUri(url.pathname),
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  /* Cada etapa reduz o alcance da chave: data, depois região, depois serviço. */
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')

  return {
    method: input.method.toUpperCase(),
    url: input.url,
    headers: {
      ...headers,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  }
}
