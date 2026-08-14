import 'server-only'

/**
 * Os textos que a recepção manda pela mão dela.
 *
 * A escolha de canal aqui é click-to-WhatsApp: o sistema escreve a mensagem e
 * abre a conversa no WhatsApp do próprio salão. Não passa pela API da Meta, e
 * por isso não tem tarifa por mensagem, verificação de CNPJ nem chip dedicado.
 * O preço disso é que quem aperta "enviar" é uma pessoa — então tudo o que dá
 * para automatizar em volta do clique, a gente automatiza: quem avisar, quando,
 * e o que escrever.
 *
 * Quando (e se) o WhatsApp oficial entrar, estes mesmos textos viram os
 * templates aprovados na Meta. Nada aqui se perde.
 */

/** As cinco rotinas. A chave é o que vai para `notification_logs.templateKey`. */
export type RoutineKey =
  | 'confirmacao'
  | 'lembrete_vespera'
  | 'bom_dia'
  | 'avaliacao'
  | 'resgate'

export interface RoutineMeta {
  key: RoutineKey
  label: string
  /** Uma linha explicando para a recepção por que aquela pessoa está na fila. */
  hint: string
}

export const ROUTINES: readonly RoutineMeta[] = [
  {
    key: 'confirmacao',
    label: 'Confirmar marcação',
    hint: 'Marcou pelo site e ainda não recebeu confirmação nenhuma.',
  },
  {
    key: 'lembrete_vespera',
    label: 'Lembrete da véspera',
    hint: 'Atende amanhã. É o aviso que mais evita falta.',
  },
  {
    key: 'bom_dia',
    label: 'Lembrete de hoje',
    hint: 'Atende hoje mais tarde.',
  },
  {
    key: 'avaliacao',
    label: 'Pedir avaliação',
    hint: 'Foi atendida ontem. Pedir opinião enquanto está fresco.',
  },
  {
    key: 'resgate',
    label: 'Resgatar cliente',
    hint: 'Faltou ou cancelou nos últimos dias. Vale oferecer outro dia.',
  },
]

export const ROUTINE_BY_KEY = new Map(ROUTINES.map((routine) => [routine.key, routine]))

/** O que o texto pode citar. Tudo já resolvido — o template não faz conta. */
export interface MessageVars {
  cliente: string
  servicos: string
  profissional: string
  data: string
  hora: string
  unidade: string
  endereco: string
}

/*
 * Sobre o tom: é a Nohora falando, não um sistema. Por isso primeira pessoa,
 * sem "prezado cliente" e sem "sua reserva foi processada com sucesso".
 *
 * O detalhe que mais importa está no lembrete da véspera: ele **convida** a
 * remarcar. Parece contra-intuitivo facilitar o cancelamento, mas cancelamento
 * com um dia de antecedência é horário que se revende — falta no dia é cadeira
 * parada com custo correndo. A frase final não é gentileza, é a feature.
 */
const BODIES: Record<RoutineKey, string> = {
  confirmacao: `Olá, {cliente}! A sua marcação está confirmada 💛

{servicos}
{data} às {hora}
com {profissional}

{unidade}
{endereco}

Qualquer coisa, é só falar comigo por aqui.`,

  lembrete_vespera: `Olá, {cliente}! É só para lembrar da sua marcação de amanhã 💛

{servicos}
{data} às {hora}
com {profissional}

{unidade}
{endereco}

Consegue vir? Se precisar de remarcar, avise-me que eu trato disso.`,

  bom_dia: `Bom dia, {cliente}! Espero por si hoje às {hora} 💛

{servicos} com {profissional}
{unidade}`,

  avaliacao: `Olá, {cliente}! Que bom tê-la recebido ontem 💛

Ficou contente com o resultado? A sua opinião ajuda-nos muito a melhorar.`,

  resgate: `Olá, {cliente}! Senti a sua falta na marcação de {data}.

Quer que eu procure um novo dia para si? Diga-me o que lhe fica melhor e eu encaixo 💛`,
}

/** Troca `{variavel}` pelo valor. Variável desconhecida some em vez de vazar chave. */
export function renderMessage(key: RoutineKey, vars: MessageVars): string {
  return BODIES[key].replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? vars[name as keyof MessageVars] : '',
  )
}

/**
 * Link que abre a conversa já com o texto escrito.
 *
 * `wa.me` decide sozinho entre app e WhatsApp Web conforme o aparelho, então
 * serve tanto para a recepção no desktop quanto para a dona no celular. O
 * telefone vai só com dígito — o `+` do formato E.164 quebra o link.
 */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
