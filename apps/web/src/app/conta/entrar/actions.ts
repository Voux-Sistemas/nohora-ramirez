'use server'

import { redirect } from 'next/navigation'
import { ehTeste } from '@/lib/ambiente'
import { toE164 } from '@/lib/format'
import { loginTestClient, requestOtp } from '@/server/auth/otp'
import { RULES, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

export interface PhoneState {
  error?: string
}

/**
 * Atalho de demonstração: "cliente" + senha fixa entra direto, sem esperar
 * código. Só existe no ambiente de teste — em produção seria credencial fixa
 * publicada no código-fonte, com acesso ao histórico de uma pessoa real.
 */
const TEST_ALIASES: Record<string, string> = {
  cliente: '+5511970000001',
}
const TEST_PASSWORD = 'cliente123'

export async function pedirCodigo(_state: PhoneState, formData: FormData): Promise<PhoneState> {
  /*
    Em produção não há canal de envio: `deliverOtpCode` só escreve no log do
    servidor. Deixar o formulário responder "código enviado" seria mentira, e a
    cliente ficaria esperando uma mensagem que não sai. Enquanto o envio não
    existir, a porta fica fechada e a tela diz o que fazer no lugar.
  */
  if (!ehTeste()) {
    return { error: 'A área da cliente ainda não está disponível. Fale com o salão para ver ou remarcar seus horários.' }
  }

  /*
    `requestOtp` já tem cooldown de um minuto por telefone. Ele não cobre quem
    varre uma lista de números para descobrir quem é cliente da casa — cada
    número é o "primeiro pedido" dele. O freio por IP cobre.
  */
  const ip = await clientIp()
  if (!hit(`otp:${ip}`, RULES.codigoOtp).ok) {
    return { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
  }

  const raw = String(formData.get('telefone') ?? '').trim().toLowerCase()
  const aliasPhone = TEST_ALIASES[raw]

  if (aliasPhone) {
    const senha = String(formData.get('senha') ?? '')
    if (senha !== TEST_PASSWORD) return { error: 'Senha incorreta.' }
    const result = await loginTestClient(aliasPhone)
    if (!result.ok) return { error: result.message }
    redirect('/conta' as never)
  }

  const phone = toE164(raw)
  if (!phone) return { error: 'Telefone inválido. Use DDD + número.' }

  const result = await requestOtp(phone)
  if (!result.ok) return { error: result.message }

  const params = new URLSearchParams({ telefone: phone })
  if (result.devCode) params.set('dev', result.devCode)
  redirect(`/conta/verificar?${params.toString()}` as never)
}
