import 'server-only'
// carrega o .env da raiz do monorepo — o Next só enxerga o de apps/web
import '@studio/db/env'
import { getDb } from '@studio/db'

/** Conexão única do app. As tabelas vêm de `@studio/db` direto. */
export const db = getDb()
