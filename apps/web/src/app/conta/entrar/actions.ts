'use server'

import { redirect } from 'next/navigation'
import { dicionario } from '@/i18n'
import { ehTeste } from '@/lib/ambiente'
import { telefoneInvalidoErroEm, toE164 } from '@/lib/format'
import { lerIdioma } from '@/lib/idioma'
import { loginClienteDisponivel, loginTestClient, requestOtp } from '@/server/auth/otp'
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
  const idioma = await lerIdioma()
  const dic = dicionario(idioma)
  const erros = dic.conta.erros

  /*
    Responder "código enviado" sem ter por onde enviar é mentira: a cliente
    ficaria esperando uma mensagem que não sai. A porta só abre quando existe
    canal (`canalEmailAtivo`) — ou no ambiente de teste, onde o código volta na
    própria tela e ninguém depende de mensagem nenhuma.
  */
  if (!loginClienteDisponivel()) {
    return { error: erros.areaIndisponivel }
  }

  /*
    `requestOtp` já tem cooldown de um minuto por telefone. Ele não cobre quem
    varre uma lista de números para descobrir quem é cliente da casa — cada
    número é o "primeiro pedido" dele. O freio por IP cobre.
  */
  const ip = await clientIp()
  if (!hit(`otp:${ip}`, RULES.codigoOtp).ok) {
    return { error: erros.muitasTentativas }
  }

  const raw = String(formData.get('telefone') ?? '').trim().toLowerCase()
  /*
    O atalho morre fora do ambiente de teste. Antes ele vinha protegido de
    carona, porque a ação inteira era fechada em produção; agora que ela abre
    junto com o canal de e-mail, o alias precisa da própria trava — senão
    "cliente" + senha impressa no código-fonte entraria numa conta real.
  */
  const aliasPhone = ehTeste() ? TEST_ALIASES[raw] : undefined

  if (aliasPhone) {
    const senha = String(formData.get('senha') ?? '')
    if (senha !== TEST_PASSWORD) return { error: erros.palavraPasseIncorreta }
    const result = await loginTestClient(aliasPhone)
    if (!result.ok) return { error: erros.codigo[result.motivo] }
    redirect('/conta' as never)
  }

  const phone = toE164(raw)
  if (!phone) return { error: telefoneInvalidoErroEm(dic.comum.telefoneInvalido, dic.gramatica.ou) }

  const result = await requestOtp(phone, idioma)
  if (!result.ok) return { error: erros.envioFalhou }

  const params = new URLSearchParams({ telefone: phone })
  if (result.destino) params.set('para', result.destino)
  if (result.devCode) params.set('dev', result.devCode)
  redirect(`/conta/verificar?${params.toString()}` as never)
}
