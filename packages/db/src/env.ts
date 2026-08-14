/**
 * Carrega o `.env` da raiz do monorepo.
 *
 * Importar ANTES de qualquer coisa que leia `process.env` — o import é um
 * efeito colateral de propósito. Sem dependência externa: `loadEnvFile` é do
 * próprio Node (20.6+).
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rootEnv = join(here, '..', '..', '..', '.env')

if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv)
}
