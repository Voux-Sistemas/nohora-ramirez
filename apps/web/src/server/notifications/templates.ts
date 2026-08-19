import 'server-only'

import type { Idioma } from '@/i18n/tipos'

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
    hint: 'Ainda não recebeu nada escrito — pelo site, pelo balcão ou por telefone.',
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
/**
 * Os corpos, por língua e depois por rotina.
 *
 * A língua é o eixo de fora porque é a primeira pergunta que se faz — quem
 * escreve não escolhe entre cinco rotinas em três línguas, escolhe a língua da
 * cliente e só depois a rotina — e porque assim uma língua nova é um bloco
 * novo em vez de cinco remendos espalhados.
 *
 * `Record<Idioma, Record<RoutineKey, string>>` é o que garante que nenhuma
 * rotina fica por traduzir: falta uma chave, falha o typecheck. O que o tipo
 * não confere são os `{buracos}` — as três versões de cada rotina citam
 * exactamente as mesmas variáveis, e é assim que se mantêm.
 *
 * As traduções seguem o mesmo tom da versão portuguesa: primeira pessoa, sem
 * "dear customer", e a véspera continua a CONVIDAR a remarcar nas três — a
 * frase final é a feature, não uma cortesia que se possa perder na tradução.
 */
const BODIES: Record<Idioma, Record<RoutineKey, string>> = {
  pt: {
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
  },

  en: {
    confirmacao: `Hello, {cliente}! Your appointment is confirmed 💛

{servicos}
{data} at {hora}
with {profissional}

{unidade}
{endereco}

If you need anything, just message me here.`,

    lembrete_vespera: `Hello, {cliente}! Just a reminder about your appointment tomorrow 💛

{servicos}
{data} at {hora}
with {profissional}

{unidade}
{endereco}

Can you still make it? If you need to reschedule, let me know and I will take care of it.`,

    bom_dia: `Good morning, {cliente}! I will be expecting you today at {hora} 💛

{servicos} with {profissional}
{unidade}`,

    avaliacao: `Hello, {cliente}! It was lovely to have you here yesterday 💛

Are you happy with the result? Your opinion helps us a great deal.`,

    resgate: `Hello, {cliente}! I missed you at your appointment on {data}.

Would you like me to find you another day? Tell me what suits you best and I will fit you in 💛`,
  },

  es: {
    confirmacao: `¡Hola, {cliente}! Su cita está confirmada 💛

{servicos}
{data} a las {hora}
con {profissional}

{unidade}
{endereco}

Para cualquier cosa, escríbame por aquí.`,

    lembrete_vespera: `¡Hola, {cliente}! Solo para recordarle su cita de mañana 💛

{servicos}
{data} a las {hora}
con {profissional}

{unidade}
{endereco}

¿Puede venir? Si necesita cambiarla, avíseme y yo me encargo.`,

    bom_dia: `¡Buenos días, {cliente}! La espero hoy a las {hora} 💛

{servicos} con {profissional}
{unidade}`,

    avaliacao: `¡Hola, {cliente}! Qué alegría haberla recibido ayer 💛

¿Quedó contenta con el resultado? Su opinión nos ayuda muchísimo a mejorar.`,

    resgate: `¡Hola, {cliente}! Eché de menos su cita del {data}.

¿Quiere que le busque otro día? Dígame qué le viene mejor y se lo encajo 💛`,
  },
}

/**
 * Troca `{variavel}` pelo valor. Variável desconhecida some em vez de vazar chave.
 *
 * O idioma é o da CLIENTE — o que ficou gravado em
 * `client_profiles.preferences.idioma` quando ela marcou — e não o de quem
 * carrega no botão: quem marcou num ecrã em inglês não reconhece um português
 * que lhe chega dias depois, do telemóvel da profissional.
 *
 * Português por omissão, e não por preferência da casa: quem marcou ao balcão
 * ou por telefone nunca passou por um selector de idioma, e não tem preferência
 * nenhuma gravada.
 */
export function renderMessage(
  key: RoutineKey,
  vars: MessageVars,
  idioma: Idioma = 'pt',
): string {
  return BODIES[idioma][key].replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in vars ? vars[name as keyof MessageVars] : '',
  )
}

/** "Marina Souza Prado" → "Marina". Mensagem de salão trata pelo primeiro nome. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
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
