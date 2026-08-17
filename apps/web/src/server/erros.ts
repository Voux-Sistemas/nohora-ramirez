import 'server-only'

/**
 * O que se pode mostrar a quem está do outro lado do ecrã, e o que não se pode.
 *
 * ── O que aconteceu ───────────────────────────────────────────────────────
 * A dona foi criar um profissional e recebeu isto, em letras vermelhas, no meio
 * da ficha:
 *
 *     Failed query: insert into "staff_profiles" ("id", "user_id", …)
 *     values (default, $1, $2, …) returning "id"
 *     params: c212345a-c2f7-4540-a3fc-825a117b6aa8,voux midia,,#95663a,true,true
 *
 * A ação apanhava a exceção e devolvia `e.message` ao formulário. Para as
 * recusas que o próprio sistema escreve — "telefone inválido", "marque pelo
 * menos uma unidade" — isso é exatamente o que se quer. Mas quando quem recusa
 * é o Postgres, `e.message` é o SQL inteiro com os valores dentro: ilegível
 * para quem trabalha no salão, e a expor nomes de tabelas e identificadores a
 * quem quer que esteja ao pé do balcão.
 *
 * ── A regra ───────────────────────────────────────────────────────────────
 * Texto do driver nunca chega ao ecrã. Vai para o log, onde é útil, e ao ecrã
 * vai a frase que a pessoa consegue usar para decidir o que fazer a seguir.
 * O que o nosso próprio código escreveu passa intacto: essas frases foram
 * pensadas para ser lidas.
 */

/**
 * Erro que veio da base de dados ou do driver, e não da nossa validação.
 *
 * O `postgres.js` marca as suas exceções com `code` (o SQLSTATE, cinco
 * caracteres) e `severity`; o drizzle embrulha a consulta falhada numa
 * mensagem que começa por `Failed query:` e guarda a original em `cause`.
 * Qualquer uma das duas assinaturas chega para saber que a frase não é nossa.
 */
function ehTecnico(e: unknown): boolean {
  if (!(e instanceof Error)) return true
  if (e.message.startsWith('Failed query')) return true
  const codigo = (e as { code?: unknown }).code
  if (typeof codigo === 'string' && /^[0-9A-Z]{5}$/.test(codigo)) return true
  return e.cause !== undefined && ehTecnico(e.cause)
}

/**
 * A frase a mostrar por causa desta exceção.
 *
 * `alternativa` é o que se diz quando a causa não é apresentável — deve nomear
 * a ação que falhou ("não foi possível guardar o profissional"), porque é a
 * única pista que sobra para quem está a olhar.
 */
export function mensagemDoErro(e: unknown, alternativa: string): string {
  if (ehTecnico(e)) {
    console.error('[recusa técnica]', e)
    return alternativa
  }
  return e instanceof Error && e.message ? e.message : alternativa
}
