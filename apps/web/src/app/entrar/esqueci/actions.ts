'use server'

import { redirect } from 'next/navigation'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { pedirRecuperacao, recuperacaoDisponivel, trocarSenhaComCodigo } from '@/server/auth/recuperacao'
import { RULES, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

export interface EsqueciState {
  error?: string
}

const FECHADO =
  'A troca de palavra-passe pela internet ainda não está ligada. Fale com quem cuida do sistema.'

export async function pedirCodigoDeSenha(
  _state: EsqueciState,
  formData: FormData,
): Promise<EsqueciState> {
  if (!recuperacaoDisponivel()) return { error: FECHADO }

  /*
    O freio é por IP porque a resposta é sempre a mesma: sem ele, dá para varrer
    uma lista de telefones sem custo nenhum. Por telefone não adiantaria — o
    atacante troca de número a cada tentativa.
  */
  const ip = await clientIp()
  if (!hit(`recuperacao:${ip}`, RULES.codigoOtp).ok) {
    return { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
  }

  const phone = toE164(String(formData.get('telefone') ?? '').trim())
  if (!phone) return { error: telefoneInvalidoErro() }

  const resultado = await pedirRecuperacao(phone)
  if (!resultado.ok) return { error: resultado.message }

  const params = new URLSearchParams({ telefone: phone })
  if (resultado.destino) params.set('para', resultado.destino)
  if (resultado.devCode) params.set('dev', resultado.devCode)
  redirect(`/entrar/nova-senha?${params.toString()}` as never)
}

export async function definirNovaSenha(
  _state: EsqueciState,
  formData: FormData,
): Promise<EsqueciState> {
  if (!recuperacaoDisponivel()) return { error: FECHADO }

  /*
    Este freio é outro: aqui já não se descobre quem existe, se adivinha o
    código. O contador por código (cinco tentativas) mora em `codigo.ts`; este
    cobre quem tenta muitos códigos em telefones diferentes.
  */
  const ip = await clientIp()
  if (!hit(`nova-senha:${ip}`, RULES.loginEquipe).ok) {
    return { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
  }

  const phone = toE164(String(formData.get('telefone') ?? '').trim())
  if (!phone) return { error: telefoneInvalidoErro() }

  const codigo = String(formData.get('codigo') ?? '').trim()
  const senha = String(formData.get('senha') ?? '')
  const confirmar = String(formData.get('confirmar') ?? '')
  if (!codigo) return { error: 'Escreva o código que chegou por e-mail.' }
  if (senha !== confirmar) return { error: 'As palavras-passe não coincidem.' }

  const resultado = await trocarSenhaComCodigo(phone, codigo, senha)
  if (!resultado.ok) return { error: resultado.message }

  /* A senha nova já entrou junto com a sessão nova: não faz sentido devolver a
     pessoa para o login que ela acabou de provar que sabe abrir. */
  redirect('/admin' as never)
}
