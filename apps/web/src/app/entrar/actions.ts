'use server'

import { redirect } from 'next/navigation'
import { ehTeste } from '@/lib/ambiente'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { verifyStaffLogin } from '@/server/auth/password'
import { RULES, forgive, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

export interface LoginState {
  error?: string
}

/** Só aceita caminho interno — evita redirecionar para fora depois do login. */
function safeNext(next: string): string {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
}

/**
 * Atalho de demonstração: "equipe" entra como a dona da conta do seed, sem
 * precisar decorar telefone.
 *
 * **Morre fora do ambiente de teste**, pela mesma razão que o atalho da cliente
 * em `conta/entrar/actions.ts`: um apelido publicado no código-fonte que aponta
 * para uma conta concreta é meio caminho andado, e esta porta dá mais acesso do
 * que aquela — do lado de lá está o cadastro da rede inteira. Aqui ainda seria
 * preciso a senha certa, mas isso é a segunda tranca, não a primeira.
 */
const TEST_ALIASES: Record<string, string> = {
  equipe: '+5511980000001',
}

export async function entrarComoEquipe(_state: LoginState, formData: FormData): Promise<LoginState> {
  const raw = String(formData.get('telefone') ?? '').trim().toLowerCase()
  const phone = (ehTeste() ? TEST_ALIASES[raw] : undefined) ?? toE164(raw)
  const senha = String(formData.get('senha') ?? '')
  const next = safeNext(String(formData.get('next') ?? ''))
  if (!phone) return { error: telefoneInvalidoErro() }
  if (!senha) return { error: 'Escreva a palavra-passe.' }

  /*
    O freio é por IP **e** por telefone. Só por IP, um escritório inteiro atrás
    do mesmo NAT se tranca sozinho; só por telefone, o atacante troca de número
    e continua. As duas chaves juntas fecham os dois caminhos.
  */
  const ip = await clientIp()
  const chaves = [`login:ip:${ip}`, `login:tel:${phone}`]
  for (const chave of chaves) {
    if (!hit(chave, RULES.loginEquipe).ok) {
      return { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
    }
  }

  const result = await verifyStaffLogin(phone, senha)
  if (!result.ok) return { error: result.message }

  // Acertou: a tentativa não conta. Quem trabalha aqui erra a senha de manhã e
  // acerta em seguida — não é para ficar de castigo por isso.
  for (const chave of chaves) forgive(chave)

  redirect(next as never)
}
