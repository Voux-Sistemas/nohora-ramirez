import './src/env'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  /*
    Migration é DDL, e DDL quer uma sessão de verdade — não o pooler de
    transação por onde o site fala. Ver `urlDireta` em src/index.ts: é o mesmo
    motivo, e num Postgres simples as duas variáveis apontam para o mesmo sítio.
  */
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
