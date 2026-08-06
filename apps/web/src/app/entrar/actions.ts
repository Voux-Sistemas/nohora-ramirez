'use server'

import { redirect } from 'next/navigation'
import { toE164 } from '@/lib/format'
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

/** Atalho de teste: "equipe" entra como a dona da conta demo, sem precisar de telefone real. */
const TEST_ALIASES: Record<string, string> = {
  equipe: '+5511980000001',
}

export async function entrarComoEquipe(_state: LoginState, formData: FormData): Promise<LoginState> {
  const raw = String(formData.get('telefone') ?? '').trim().toLowerCase()
  const phone = TEST_ALIASES[raw] ?? toE164(raw)
  const senha = String(formData.get('senha') ?? '')
  const next = safeNext(String(formData.get('next') ?? ''))
  if (!phone) return { error: 'Telefone inválido.' }
  if (!senha) return { error: 'Digite a senha.' }

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
