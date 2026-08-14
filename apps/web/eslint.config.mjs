import { FlatCompat } from '@eslint/eslintrc'

/**
 * O linter da aplicação.
 *
 * Estava a faltar, e a falta não era silenciosa: havia nove
 * `// eslint-disable-next-line` espalhados pelo código — em `otp.ts`, na
 * galeria, no seed — a pedir dispensa a um linter que ninguém tinha instalado.
 * Comentário que não desliga nada é pior do que comentário nenhum: quem lê
 * assume que a regra existe e que alguém a pesou.
 *
 * `next/core-web-vitals` é a configuração da própria framework — traz as regras
 * de acessibilidade de JSX, as de Hooks e as que apanham os enganos que só o
 * App Router tem (`<img>` onde devia estar `<Image>`, `<a>` onde devia estar
 * `<Link>`). `no-console` vem por cima porque o log do Railway é legível a quem
 * tiver o painel, e este sistema imprime códigos de acesso em desenvolvimento:
 * a regra obriga a que cada impressão seja uma decisão escrita, não um resto de
 * depuração. `error` e `warn` passam — são para diagnóstico e não carregam
 * segredo.
 */
const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals'),
  {
    linterOptions: {
      /* Uma dispensa que já não dispensa nada é ruído a apontar para uma regra
         que mudou de sítio. Isto obriga a que ela apareça no relatório. */
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
]

export default config
