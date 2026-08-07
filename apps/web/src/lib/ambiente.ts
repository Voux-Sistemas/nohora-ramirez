/**
 * Qual ambiente este processo está servindo.
 *
 * Existe um só interruptor porque três flags separadas viram, com o tempo, três
 * chances de esquecer uma. O que muda entre teste e produção:
 *
 * - atalhos de login sem senha real (demonstração)
 * - código de OTP devolvido na resposta em vez de enviado
 * - área da cliente ligada mesmo sem canal de envio
 *
 * O padrão é **fechado**: sem `AMBIENTE` declarado, um processo com
 * `NODE_ENV=production` é tratado como produção. Quem quer os atalhos precisa
 * pedir por escrito — é o ambiente de teste que carrega `AMBIENTE=teste`, não o
 * contrário. Esquecer a variável degrada para o lado seguro.
 */
export type Ambiente = 'teste' | 'producao'

export function ambiente(): Ambiente {
  const declarado = process.env.AMBIENTE
  if (declarado === 'teste' || declarado === 'producao') return declarado
  return process.env.NODE_ENV === 'production' ? 'producao' : 'teste'
}

/** `true` só em desenvolvimento e no ambiente de teste declarado. */
export function ehTeste(): boolean {
  return ambiente() === 'teste'
}
