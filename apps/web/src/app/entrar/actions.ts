'use server'

/**
 * As duas entradas: a da cliente (telemóvel + código) e a da equipa
 * (telemóvel + senha).
 *
 * Ficam no mesmo arquivo porque são a mesma porta com duas fechaduras, e
 * porque separá-las foi o que fez as telas divergirem — uma mandava para
 * `/conta`, a outra para `/admin`, e ninguém notou durante meses.
 */

import { redirect } from 'next/navigation'
import { ehTeste } from '@/lib/ambiente'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { href } from '@/lib/utils'
import { loginClienteDisponivel, loginTestClient, requestOtp } from '@/server/auth/otp'
import { verifyStaffLogin } from '@/server/auth/password'
import { RULES, forgive, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

// ─── cliente ────────────────────────────────────────────────────────────────

export interface EstadoTelefone {
  erro?: string
}

/**
 * Atalho de demonstração: "cliente" + senha fixa entra directo, sem esperar
 * código. Só existe no ambiente de teste — em produção seria credencial fixa
 * publicada no código-fonte, com acesso ao histórico de uma pessoa real.
 */
const ALIAS_CLIENTE: Record<string, string> = {
  cliente: '+5511970000001',
}
const SENHA_TESTE = 'cliente123'

export async function pedirCodigo(
  _estado: EstadoTelefone,
  formData: FormData,
): Promise<EstadoTelefone> {
  /*
    Responder "código enviado" sem ter por onde enviar é mentira: a cliente
    ficaria à espera de uma mensagem que não sai. A porta só abre quando existe
    canal — ou no ambiente de teste, onde o código volta na própria tela.
  */
  if (!loginClienteDisponivel()) {
    return {
      erro: 'A área da cliente ainda não está disponível. Ligue para o salão para ver ou remarcar os seus horários.',
    }
  }

  /*
    `requestOtp` já tem arrefecimento de um minuto por telemóvel. Ele não cobre
    quem varre uma lista de números para descobrir quem é cliente da casa —
    cada número é o "primeiro pedido" dele. O freio por IP cobre.
  */
  const ip = await clientIp()
  if (!hit(`otp:${ip}`, RULES.codigoOtp).ok) {
    return { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
  }

  const bruto = String(formData.get('telefone') ?? '')
    .trim()
    .toLowerCase()
  /*
    O atalho morre fora do ambiente de teste. Sem a trava própria, "cliente"
    mais a senha impressa no código-fonte entraria numa conta real.
  */
  const aliasTelefone = ehTeste() ? ALIAS_CLIENTE[bruto] : undefined

  if (aliasTelefone) {
    const senha = String(formData.get('senha') ?? '')
    if (senha !== SENHA_TESTE) return { erro: 'Senha incorrecta.' }
    const resultado = await loginTestClient(aliasTelefone)
    if (!resultado.ok) return { erro: resultado.message }
    redirect('/minha-conta')
  }

  const telefone = toE164(bruto)
  if (!telefone) return { erro: telefoneInvalidoErro() }

  const resultado = await requestOtp(telefone)
  if (!resultado.ok) return { erro: resultado.message }

  const params = new URLSearchParams({ telefone })
  if (resultado.destino) params.set('para', resultado.destino)
  if (resultado.devCode) params.set('dev', resultado.devCode)
  redirect(`/entrar/codigo?${params.toString()}`)
}

// ─── equipa ─────────────────────────────────────────────────────────────────

export interface EstadoLogin {
  erro?: string
}

/** Só aceita caminho interno — evita redireccionar para fora depois do login. */
function destinoSeguro(destino: string): string {
  return destino.startsWith('/') && !destino.startsWith('//') ? destino : '/painel'
}

/** Atalho de teste: "equipa" entra como a dona da conta de demonstração. */
const ALIAS_EQUIPA: Record<string, string> = {
  equipa: '+5511980000001',
  equipe: '+5511980000001',
}

export async function entrarComoEquipa(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const bruto = String(formData.get('telefone') ?? '')
    .trim()
    .toLowerCase()
  const telefone = ALIAS_EQUIPA[bruto] ?? toE164(bruto)
  const senha = String(formData.get('senha') ?? '')
  const destino = destinoSeguro(String(formData.get('destino') ?? ''))
  if (!telefone) return { erro: telefoneInvalidoErro() }
  if (!senha) return { erro: 'Escreva a senha.' }

  /*
    O freio é por IP **e** por telemóvel. Só por IP, um escritório inteiro
    atrás do mesmo NAT tranca-se sozinho; só por telemóvel, o atacante troca de
    número e continua. As duas chaves juntas fecham os dois caminhos.
  */
  const ip = await clientIp()
  const chaves = [`login:ip:${ip}`, `login:tel:${telefone}`]
  for (const chave of chaves) {
    if (!hit(chave, RULES.loginEquipe).ok) {
      return { erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
    }
  }

  const resultado = await verifyStaffLogin(telefone, senha)
  if (!resultado.ok) return { erro: resultado.message }

  /* Acertou: a tentativa não conta. Quem trabalha aqui erra a senha de manhã e
     acerta a seguir — não é para ficar de castigo por isso. */
  for (const chave of chaves) forgive(chave)

  /* `href` porque o destino é montado em tempo de execução a partir de
     `?destino=` — já validado acima como caminho interno. É o único ponto
     onde a garantia de rota tipada é abandonada de propósito. */
  redirect(href(destino))
}
