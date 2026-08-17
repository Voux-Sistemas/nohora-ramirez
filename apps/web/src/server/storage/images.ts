import 'server-only'
import { randomBytes } from 'node:crypto'
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  extensionFor,
  imageStore,
  sniffImageType,
} from './index'

/*
  A camada que as actions chamam. Recebe o `File` do FormData, valida, guarda e
  devolve a URL que vai para a coluna. Quem chama não sabe onde o arquivo ficou.
*/

export type UploadScope = 'unidades' | 'servicos' | 'equipe'

export interface UploadResult {
  url: string
  key: string
}

export class UploadError extends Error {}

/*
  Mensagens em português e no tom do produto: quem sobe foto aqui é a recepção
  entre uma cliente e outra, não um desenvolvedor lendo stack trace.
*/
const MESSAGES = {
  empty: 'Nenhum ficheiro escolhido.',
  tooBig: `A imagem passa de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB. Reduza e tente de novo.`,
  wrongType: 'Formato não aceite. Envie JPG, PNG, WebP ou AVIF.',
} as const

/**
 * Guarda uma imagem enviada e devolve a URL pública.
 *
 * `ownerId` entra na chave para os arquivos de uma unidade ou serviço ficarem
 * juntos; o sufixo aleatório garante que trocar a foto não reaproveite a URL
 * antiga (que está cacheada como imutável no navegador da cliente).
 */
export async function storeUploadedImage(
  file: File,
  scope: UploadScope,
  ownerId: string,
): Promise<UploadResult> {
  return gravar(await conferir(file), scope, ownerId)
}

/**
 * Confere sem gravar.
 *
 * Serve a quem precisa de recusar a fotografia **antes** de criar o registo que
 * ela acompanha. A chave do ficheiro é montada com o id do dono, portanto num
 * serviço ou numa loja nova a gravação só pode acontecer depois do insert — e
 * uma recusa nessa altura deixava o registo criado e a dona de volta ao
 * formulário, onde carregar em Guardar outra vez criava um segundo. Com esta
 * pergunta feita primeiro, os motivos comuns (ficheiro grande demais, HEIC do
 * telemóvel) recusam antes de existir seja o que for.
 *
 * Custa ler os bytes duas vezes, porque `storeUploadedImage` volta a lê-los.
 * `MAX_IMAGE_BYTES` mantém isso barato, e passar o buffer de mão em mão por
 * quatro camadas custava mais em confusão do que em memória.
 */
export async function conferirImagem(file: File): Promise<void> {
  await conferir(file)
}

/**
 * Um lote de imagens — tudo ou nada.
 *
 * A galeria da loja recebe várias fotos de uma vez, e gravar as três primeiras
 * antes de descobrir que a quarta é um HEIC deixaria a dona com meia galeria e
 * uma mensagem de erro. Confere o lote inteiro primeiro; só então grava.
 *
 * Segurar todos os bytes em memória de uma vez é aceitável porque o corpo da
 * requisição já tem teto (`serverActions.bodySizeLimit`, em next.config.ts): o
 * lote não passa do que aquele limite deixa entrar.
 */
export async function storeUploadedImages(
  files: readonly File[],
  scope: UploadScope,
  ownerId: string,
): Promise<UploadResult[]> {
  const conferidas: Conferida[] = []
  for (const file of files) conferidas.push(await conferir(file))

  const guardadas: UploadResult[] = []
  for (const item of conferidas) guardadas.push(await gravar(item, scope, ownerId))
  return guardadas
}

interface Conferida {
  body: Buffer
  contentType: string
}

async function conferir(file: File): Promise<Conferida> {
  if (file.size === 0) throw new UploadError(MESSAGES.empty)
  if (file.size > MAX_IMAGE_BYTES) throw new UploadError(MESSAGES.tooBig)

  const body = Buffer.from(await file.arrayBuffer())

  /*
    O tipo vem dos bytes, não do `file.type`. O cabeçalho do FormData é escrito
    pelo cliente; um .html renomeado para .jpg chegaria aqui declarando
    `image/jpeg` e sairia servido com esse Content-Type se acreditássemos nele.
  */
  const contentType = sniffImageType(body)
  if (!contentType || !ACCEPTED_IMAGE_TYPES.includes(contentType as never)) {
    throw new UploadError(MESSAGES.wrongType)
  }

  return { body, contentType }
}

async function gravar(
  { body, contentType }: Conferida,
  scope: UploadScope,
  ownerId: string,
): Promise<UploadResult> {
  const key = `${scope}/${safeId(ownerId)}/${randomBytes(8).toString('hex')}.${extensionFor(contentType)}`
  const stored = await imageStore().put({ key, body, contentType })
  return { url: stored.url, key: stored.key }
}

/** Só o que o regex da rota de leitura aceita como segmento. */
function safeId(value: string): string {
  const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return clean || 'sem-dono'
}

/**
 * Descarta o arquivo anterior quando a URL foi substituída.
 *
 * Só age sobre URLs do nosso próprio driver — a foto ilustrativa do Unsplash do
 * catálogo de demonstração não é nossa para apagar.
 */
export async function discardImage(url: string | null | undefined): Promise<void> {
  if (!url?.startsWith('/api/imagens/')) return
  await imageStore().remove(url.slice('/api/imagens/'.length))
}
