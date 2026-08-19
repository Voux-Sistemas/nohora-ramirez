import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Só o que é lógica pura: `src/lib` e os dicionários de `src/i18n`. Tela não
 * entra aqui — o portão de tela é o `next build`, que já reprova import
 * quebrado e tipo errado.
 *
 * Os dicionários são dados, não lógica, mas partem-se pela mesma razão que um
 * algoritmo se parte: uma chave que só existe em português passa o typecheck
 * (o tipo é `typeof pt`) e só se vê em produção, na língua errada.
 */
export default defineConfig({
  /*
    O `@/` do tsconfig não chega ao vitest — quem o resolve em produção é o
    empacotador do Next, que não corre aqui. Sem esta linha, um ficheiro de
    `src/lib` que importe `@/i18n` passa o typecheck e rebenta no teste com
    "cannot find package", que é um erro que aponta para o sítio errado.
  */
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/lib/**/*.test.ts', 'src/i18n/**/*.test.ts'],
    environment: 'node',
  },
})
