import 'server-only'

import { headers } from 'next/headers'

/**
 * De onde veio a requisição.
 *
 * Atrás do proxy da Railway, `x-forwarded-for` chega como uma lista da borda até
 * aqui. O primeiro item é o cliente; os seguintes são os saltos. Confiar no
 * primeiro só é seguro porque quem monta esse cabeçalho é o proxy da plataforma
 * — se um dia a aplicação for exposta direto, este é o ponto que precisa mudar.
 */
export async function clientIp(): Promise<string> {
  const h = await headers()

  const encaminhado = h.get('x-forwarded-for')
  if (encaminhado) {
    const primeiro = encaminhado.split(',')[0]?.trim()
    if (primeiro) return primeiro
  }

  return h.get('x-real-ip')?.trim() || 'desconhecido'
}
