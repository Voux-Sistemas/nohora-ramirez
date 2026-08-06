import 'server-only'

/**
 * Hash de senha e de código OTP com scrypt nativo do Node — sem dependência
 * externa. Formato armazenado: `salt:hash`, ambos hex.
 */

import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = (await scryptAsync(plain, salt, 64)) as Buffer
  return `${salt}:${derived.toString('hex')}`
}

export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = (await scryptAsync(plain, salt, 64)) as Buffer
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
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
