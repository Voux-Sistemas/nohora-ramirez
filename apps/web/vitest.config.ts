import { defineConfig } from 'vitest/config'

/**
 * Só o que é lógica pura de `src/lib`. Tela não entra aqui — o portão de tela
 * é o `next build`, que já reprova import quebrado e tipo errado.
 */
export default defineConfig({
  test: {
    include: ['src/lib/**/*.test.ts'],
    environment: 'node',
  },
})
