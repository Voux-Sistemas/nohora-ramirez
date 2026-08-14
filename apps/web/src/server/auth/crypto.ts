import 'server-only'

/**
 * Hash de senha e de código OTP com scrypt nativo do Node — sem dependência
 * externa.
 *
 * ## O custo fica gravado junto com o hash
 *
 * Formato novo: `scrypt$<N>$<salt>$<hash>`. Formato antigo, ainda aceite:
 * `salt:hash`, que era sempre o N padrão do Node.
 *
 * Guardar o custo no próprio registo é o que permite subi-lo sem partir nada.
 * Sem ele, aumentar o N invalidava **todas** as senhas já gravadas de uma vez:
 * o hash antigo continuaria no banco, a verificação passaria a derivar com
 * outro custo, e ninguém mais entrava — a dona incluída, num sábado de manhã.
 * Com o custo no registo, cada senha verifica-se com o custo com que nasceu, e
 * `precisaRehash` avisa quem entrou com uma antiga para ser regravada forte na
 * hora (ver `verifyStaffLogin`).
 */

import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

/*
  `promisify` escolhe uma das sobrecargas de `scrypt` e fica com a que não
  recebe opções — e é justamente nas opções que vive o custo. A assinatura
  explícita aqui recupera a versão de cinco argumentos.
*/
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

/**
 * 2^16. A OWASP pede no mínimo isto para scrypt com `r=8, p=1`; o padrão do
 * Node é 2^14, quatro vezes mais barato de atacar. Subir o N é subir o preço
 * de cada tentativa de quem levar o banco embora.
 */
const N = 65_536

/**
 * scrypt gasta `128 * N * r` bytes — 64 MiB com este N. O `maxmem` do Node
 * está em 32 MiB por omissão, portanto sem esta linha a derivação não falha
 * silenciosamente: rebenta com `ERR_CRYPTO_INVALID_SCRYPT_PARAMS`, e ninguém
 * entra. É por isso que anda sempre colada ao N.
 */
const OPCOES = { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 } as const

/** O que o formato antigo `salt:hash` usava, sem o dizer: o padrão do Node. */
const N_LEGADO = 16_384

async function derivar(plain: string, salt: string, custo: number): Promise<Buffer> {
  return scryptAsync(plain, salt, 64, { ...OPCOES, N: custo })
}

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = await derivar(plain, salt, N)
  return `scrypt$${N}$${salt}$${derived.toString('hex')}`
}

/** Separa o registo guardado nas suas três partes, nos dois formatos. */
function ler(stored: string): { custo: number; salt: string; hash: string } | null {
  if (stored.startsWith('scrypt$')) {
    const [, custo, salt, hash] = stored.split('$')
    const n = Number(custo)
    if (!Number.isSafeInteger(n) || n <= 0 || !salt || !hash) return null
    return { custo: n, salt, hash }
  }

  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return null
  return { custo: N_LEGADO, salt, hash }
}

export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const partes = ler(stored)
  if (!partes) return false

  const derived = await derivar(plain, partes.salt, partes.custo)
  const expected = Buffer.from(partes.hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

/** Verdadeiro quando o registo nasceu com um custo abaixo do de hoje. */
export function precisaRehash(stored: string): boolean {
  const partes = ler(stored)
  return partes === null || partes.custo < N
}

export function randomToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Token de sessão já é aleatório de alta entropia — não precisa de scrypt,
 * um hash rápido serve só para não guardar o token em claro no banco.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Código de 6 dígitos, sempre com zero à esquerda quando precisar. */
export function randomOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}
