'use client'

/**
 * A rede de segurança de baixo de tudo.
 *
 * Só aparece quando o erro acontece no próprio layout raiz — antes das fontes,
 * antes do CSS, antes de qualquer componente. Por isso aqui **nada é
 * importado**: nem Tailwind, nem `Recado`, nem a tipografia da marca. O React
 * troca a árvore inteira, e um import que dependesse do que quebrou quebraria
 * junto, deixando a tela em branco — que é o pior desfecho possível, porque
 * branco não dá nem o que contar para quem for consertar.
 *
 * As cores vêm cravadas em hexadecimal, com o esquema escuro por
 * `prefers-color-scheme`: são os mesmos travertino e tinta do sistema, ditos
 * sem depender do arquivo de tokens.
 */

const CSS = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f2ece4;
    color: #1c1714;
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .caixa {
    max-width: 28rem;
    margin: 0 auto;
    min-height: 80dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 3rem 1.25rem;
  }
  h1 {
    font-family: Didot, 'Bodoni MT', Georgia, serif;
    font-weight: 400;
    font-size: clamp(1.75rem, 3.6vw, 2.25rem);
    line-height: 1.06;
    letter-spacing: -0.015em;
    margin: 0;
  }
  .regua {
    height: 1px;
    width: 4rem;
    margin-top: 1rem;
    background: linear-gradient(90deg, #95663a 0%, #95663a 28%, rgba(149, 102, 58, 0.2) 100%);
  }
  p { font-size: 0.9375rem; line-height: 1.65; margin: 1.25rem 0 0; }
  .fraco { color: #6b6058; font-size: 0.75rem; margin-top: 2rem; }
  button {
    margin-top: 1.75rem;
    align-self: flex-start;
    height: 2.75rem;
    padding: 0 1rem;
    border: 0;
    border-radius: 4px;
    background: #1c1714;
    color: #faf7f2;
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }
  button:active { transform: translateY(1px); }
  @media (prefers-color-scheme: dark) {
    body { background: #14100e; color: #f4f1ec; }
    .fraco { color: #a49a90; }
    button { background: #f4f1ec; color: #14100e; }
  }
`

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="caixa">
          <h1>O sistema não conseguiu abrir</h1>
          <div className="regua" />
          <p>
            Isso é mais grave que um erro de tela: falhou antes de a página existir. Recarregue
            uma vez; se voltar a acontecer, avise a administração.
          </p>
          <button type="button" onClick={reset}>
            Recarregar
          </button>
          {error.digest ? <p className="fraco">código do erro: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  )
}
