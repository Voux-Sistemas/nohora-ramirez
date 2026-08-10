import 'server-only'

/**
 * O canal de e-mail.
 *
 * É o único envio automático do sistema. O WhatsApp continua sendo a recepção
 * clicando num link — de graça e com uma pessoa do outro lado. E-mail existe
 * para a coisa que **não pode** depender de alguém clicar: o código de acesso
 * da cliente, que precisa sair às onze da noite de um domingo.
 *
 * ── Por que Resend ────────────────────────────────────────────────────────
 * Três mil mensagens por mês de graça, cadastro sem cartão, e uma API que é um
 * POST — sem SDK, sem dependência nova no `package.json`, sem processo de
 * aprovação de template como o do WhatsApp. Para um salão que vai mandar
 * algumas dezenas de códigos por dia, isso é excedente com folga.
 *
 * ── Trocar de provedor ────────────────────────────────────────────────────
 * `entregar` é o único ponto que conhece o Resend. Qualquer outro serviço é
 * reescrever essa função: o resto do sistema só chama `enviarEmail`.
 *
 * ── Por que ele pode estar desligado ──────────────────────────────────────
 * Um remetente que o mundo aceita exige domínio próprio verificado. Enquanto o
 * `.com.br` não existir, `canalEmailAtivo()` devolve `false` e quem depende do
 * canal diz a verdade em vez de fingir que enviou. Ligar é preencher duas
 * variáveis no Railway — nada de código.
 */

const ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 8000

/** As duas variáveis que ligam o canal. Ausentes, ele fica desligado. */
function config(): { apiKey: string; remetente: string } | null {
  const apiKey = process.env.RESEND_API_KEY
  const remetente = process.env.EMAIL_REMETENTE
  if (!apiKey || !remetente) return null
  return { apiKey, remetente }
}

export function canalEmailAtivo(): boolean {
  return config() !== null
}

export interface Email {
  para: string
  assunto: string
  /** Corpo em texto puro. Obrigatório: é o que o leitor de tela e o cliente de e-mail antigo mostram. */
  texto: string
  /** Versão em HTML. Opcional — sem ela vai só o texto, que continua legível. */
  html?: string
}

export interface ResultadoEnvio {
  ok: boolean
  /** Só para o log do servidor. Nunca vai para a tela: erro de provedor não é recado de cliente. */
  erro?: string
}

export async function enviarEmail(email: Email): Promise<ResultadoEnvio> {
  const cfg = config()
  if (!cfg) return { ok: false, erro: 'canal de e-mail desligado (falta RESEND_API_KEY ou EMAIL_REMETENTE)' }

  try {
    return await entregar(cfg, email)
  } catch (error) {
    /* Timeout, DNS, provedor fora do ar. Nada disso pode derrubar a requisição
       de quem pediu o código — quem chamou decide o que dizer à pessoa. */
    return { ok: false, erro: String(error) }
  }
}

async function entregar(
  cfg: { apiKey: string; remetente: string },
  email: Email,
): Promise<ResultadoEnvio> {
  const resposta = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${cfg.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: cfg.remetente,
      to: [email.para],
      subject: email.assunto,
      text: email.texto,
      ...(email.html ? { html: email.html } : {}),
    }),
    /* Sem isto, um provedor lento segura a resposta da tela até o navegador
       desistir — e a cliente conclui que o botão não funciona. */
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '')
    return { ok: false, erro: `resend ${resposta.status}: ${corpo.slice(0, 300)}` }
  }

  return { ok: true }
}

/**
 * `maria.silva@gmail.com` → `ma••••@gmail.com`.
 *
 * A tela precisa dizer para onde o código foi, senão quem tem dois e-mails não
 * sabe qual caixa abrir. Mas mostrar o endereço inteiro entregaria o e-mail de
 * uma cliente a quem só digitou o telefone dela — e telefone de salão circula.
 */
export function mascararEmail(email: string): string {
  const [usuario = '', dominio = ''] = email.split('@')
  if (!dominio) return '•••'
  const visivel = usuario.slice(0, 2)
  return `${visivel}${'•'.repeat(Math.max(usuario.length - 2, 3))}@${dominio}`
}
