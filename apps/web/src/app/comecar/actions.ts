'use server'

import { redirect } from 'next/navigation'
import { telefoneInvalidoErro, toE164 } from '@/lib/format'
import { criarPrimeiraConta } from '@/server/auth/instalacao'
import { RULES, hit } from '@/server/security/rate-limit'
import { clientIp } from '@/server/security/request'

export interface InstalarState {
  error?: string
}

export async function instalar(_state: InstalarState, formData: FormData): Promise<InstalarState> {
  // O freio vem antes de qualquer leitura do formulário: quem está adivinhando
  // código não precisa nem chegar perto do banco.
  const ip = await clientIp()
  if (!hit(`instalar:${ip}`, RULES.instalacao).ok) {
    return { error: 'Muitas tentativas. Espere alguns minutos e tente de novo.' }
  }

  const nome = String(formData.get('nome') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const senha = String(formData.get('senha') ?? '')
  const confirmar = String(formData.get('confirmar') ?? '')
  const codigo = String(formData.get('codigo') ?? '').trim()
  const phone = toE164(String(formData.get('telefone') ?? '').trim())

  if (nome.length < 2) return { error: 'Diga o nome completo.' }
  if (!phone) return { error: telefoneInvalidoErro() }
  /* Conferência de formato, não de existência — o que importa aqui é não
     gravar um endereço obviamente quebrado na única conta sem plano B. */
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'E-mail inválido.' }
  if (senha.length < 8) return { error: 'A palavra-passe tem de ter pelo menos 8 caracteres.' }
  if (senha !== confirmar) return { error: 'As palavras-passe não coincidem.' }
  if (!codigo) return { error: 'Escreva o código de instalação.' }

  const result = await criarPrimeiraConta({ nome, phone, email, senha, codigo })
  if (!result.ok) return { error: result.message }

  // Direto para as unidades: sem pelo menos uma, nada mais no sistema tem onde
  // acontecer. É o primeiro cadastro de verdade, então é para onde a tela leva.
  redirect('/admin/unidades')
}
