/**
 * Como número, data e telefone aparecem na tela.
 *
 * Nada aqui decide país — quem decide é `lib/pais.ts`. Este arquivo só aplica.
 * Foi assim que o salão português deixou de ver preço em real: uma troca de
 * variável, não uma varredura por catorze telas.
 *
 * Tudo que é hora recebe a timezone da unidade explicitamente: o servidor roda
 * em UTC e a recepção não pode ver 20:00 onde a cliente marcou 17:00.
 */

import { pais } from './pais'

export function formatMoney(cents: number): string {
  const { locale, moeda } = pais()
  return (cents / 100).toLocaleString(locale, { style: 'currency', currency: moeda })
}

/** "€" — para rótulo de campo (`Preço (€)`), onde `formatMoney` já formataria
 *  o número inteiro e seria demais. */
export function simboloMoeda(): string {
  return (0).toLocaleString(pais().locale, { style: 'currency', currency: pais().moeda })
    .replace(/[\d.,\s]/g, '')
}

/**
 * O campo de dinheiro como a pessoa o escreve → cêntimos, ou `null` se não for
 * número. Vírgula e ponto valem os dois: o teclado do telemóvel oferece um, o
 * teclado numérico oferece o outro, e quem está ao balcão não está a pensar em
 * nenhum dos dois. Campo vazio é zero, não erro — é assim que se deixa em
 * branco um desconto que não houve.
 *
 * Vive aqui, e não em cada tela, porque a conta que o formulário mostra ao vivo
 * e a conta que a ação confere no servidor têm de ser a mesma conta.
 */
export function paraCentimos(texto: string): number | null {
  const limpo = texto.trim()
  if (limpo === '') return 0
  const numero = Number(limpo.replace(',', '.'))
  if (!Number.isFinite(numero) || numero < 0) return null
  return Math.round(numero * 100)
}

/**
 * O preço partido em número e símbolo, e sem os cêntimos quando não os há.
 *
 * Num preçário de salão quase todo o valor é redondo, e escrever "15,00 €"
 * cinquenta e oito vezes são cento e dezasseis caracteres que não dizem nada
 * numa coluna cuja única função é ser lida de relance. Onde os cêntimos
 * existem ficam, porque aí são preço — é por isso que isto não é o
 * `formatMoneyShort`, que arredonda e transformaria 12,50 € em 13 €.
 *
 * Vem partido em dois porque a montra escreve o número com a voz do texto forte
 * e o símbolo com a do texto quieto: a coluna de números fica limpa e o "€"
 * deixa de competir com ela. Partido por `formatToParts` e não por `split`:
 * em pt-PT o símbolo vem depois do número, noutras praças vem à frente, e quem
 * sabe qual é o caso é o `Intl` — não nós.
 */
export function partesDoPreco(cents: number): { valor: string; moeda: string } {
  const { locale, moeda } = pais()
  const partes = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moeda,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).formatToParts(cents / 100)

  return {
    valor: partes
      .filter((parte) => parte.type !== 'currency')
      .map((parte) => parte.value)
      .join('')
      .trim(),
    moeda: partes.find((parte) => parte.type === 'currency')?.value ?? '',
  }
}

/** Sem cêntimos — para números grandes de painel. */
export function formatMoneyShort(cents: number): string {
  const { locale, moeda } = pais()
  return (cents / 100).toLocaleString(locale, {
    style: 'currency',
    currency: moeda,
    maximumFractionDigits: 0,
  })
}

export function formatTime(instant: Date | string, timeZone: string): string {
  return new Date(instant).toLocaleTimeString(pais().locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  })
}

export function formatDateLong(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(pais().locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

/** "agosto" — para o painel dizer, por extenso, que mês está a ler. */
export function formatMonthLong(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(pais().locale, {
    month: 'long',
    timeZone: 'UTC',
  })
}

export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString(pais().locale, {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

/**
 * "seg", "ter", "sáb" — o rótulo de uma coluna de calendário.
 *
 * O `weekday: 'short'` do ICU não abrevia em português: devolve "segunda",
 * "domingo", "sábado". Na grelha de dias da marcação são sete colunas no ecrã
 * do telemóvel, e "SEGUNDA" em maiúsculas espaçadas transbordava a coluna e
 * empurrava o número do dia para baixo. Três letras é o que o calendário
 * português usa, e nos idiomas em que o ICU já abrevia isto não mexe em nada.
 */
export function formatWeekdayShort(isoDate: string): string {
  const dia = new Date(`${isoDate}T12:00:00Z`)
    .toLocaleDateString(pais().locale, { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
  return dia.length > 3 ? dia.slice(0, 3) : dia
}

/** "1h30" / "45min" — o jeito que a recepção fala. */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`
}

/** `+351934730344` → `934 730 344` */
export function formatPhone(e164: string): string {
  const { ddi, digitosNacionais, formatarNacional } = pais()
  const digits = e164.replace(/\D/g, '')
  const nacional = digits.startsWith(ddi) ? digits.slice(ddi.length) : digits
  /* Número de outro país (uma cliente que veio do Brasil, um registo antigo)
     sai como está. Formatar com a régua errada inventaria um número que não
     existe, e é a recepção que vai discar. */
  if (!digitosNacionais.includes(nacional.length)) return e164
  return formatarNacional(nacional)
}

/** Aceita o que a pessoa digitar e devolve E.164, ou null se não der. */
export function toE164(input: string): string | null {
  const { ddi, digitosNacionais } = pais()
  /* `00` é o prefixo de saída internacional que muita gente digita antes do
     indicativo. Não é parte de número nenhum. */
  const digits = input.replace(/\D/g, '').replace(/^00/, '')

  /*
     Tentar tirar o indicativo primeiro, mas só aceitar o que sobra se tiver
     comprimento nacional válido. No Brasil isto importa: `55998887777` é o DDD
     55 com nove dígitos, não o indicativo 55 mais um número de nove — e o teste
     de comprimento é o que separa os dois.
  */
  if (digits.startsWith(ddi)) {
    const semDdi = digits.slice(ddi.length)
    if (digitosNacionais.includes(semDdi.length)) return `+${ddi}${semDdi}`
  }
  if (digitosNacionais.includes(digits.length)) return `+${ddi}${digits}`
  return null
}

/** Só dígitos — descarta espaço, parêntese, traço e o que mais tiver entrado
 *  colado ou digitado por engano. */
export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/**
 * Agrupa dígitos parciais como o país agrupa (`pais().agrupamentoNacional`) —
 * a máscara ao vivo do campo de telefone, tecla a tecla. Diferente de
 * `formatPhone`: aqui o número pode estar pela metade, então só formata o que
 * já foi digitado em vez de exigir o comprimento inteiro.
 *
 * O indicativo sai antes do corte, e é isto que impede a máscara de corromper
 * um número que já estava certo. Esta função não recebe só o que a pessoa
 * digita: `PhoneInput` passa-lhe também o `defaultValue`, que vem da base em
 * E.164. Com `+351934730344` à entrada e o corte a nove dígitos feito primeiro,
 * ficava `351 934 730` — e `toE164` aceitava isso como nove dígitos nacionais
 * legítimos e gravava `+351351934730`. A ficha da cliente mostrava o número
 * certo no cabeçalho e outro no campo, e bastava carregar em Guardar por
 * qualquer motivo — juntar uma etiqueta, a data de nascimento — para trocar o
 * telemóvel dela em silêncio. A cada gravação seguinte degradava mais.
 *
 * O teste de comprimento é o mesmo do `toE164`, e pela mesma razão: no Brasil,
 * `55998887777` é o DDD 55 com nove dígitos, não o indicativo 55 mais um
 * número. Só se descarta o indicativo quando o que sobra tem comprimento
 * nacional válido — senão a máscara partia-se a meio da digitação.
 */
export function formatPhoneLive(raw: string): string {
  const { agrupamentoNacional, digitosNacionais, ddi } = pais()
  const max = Math.max(...digitosNacionais)
  const brutos = apenasDigitos(raw)
  /* `00` só é prefixo de saída quando o indicativo vem logo a seguir. Cortá-lo
     sempre faria o campo esvaziar-se sozinho na segunda tecla de quem começa a
     escrever por zero. */
  const todos = brutos.startsWith(`00${ddi}`) ? brutos.slice(2) : brutos
  const semDdi = todos.startsWith(ddi) ? todos.slice(ddi.length) : ''
  const digitos = (digitosNacionais.includes(semDdi.length) ? semDdi : todos).slice(0, max)
  const partes: string[] = []
  let i = 0
  for (const tamanho of agrupamentoNacional) {
    if (i >= digitos.length) break
    partes.push(digitos.slice(i, i + tamanho))
    i += tamanho
  }
  return partes.join(' ')
}

/**
 * Mensagem para quando `toE164` devolve `null`, no vocabulário do país
 * configurado. "DDD" é conceito só do Brasil — usar essa palavra para uma
 * cliente portuguesa é o mesmo tipo de erro que motivou criar `lib/pais.ts`
 * (ver o comentário lá).
 */
export function telefoneInvalidoErro(): string {
  const { rotulos, digitosNacionais } = pais()
  const digitos =
    digitosNacionais.length === 1
      ? `${digitosNacionais[0]} dígitos`
      : `${digitosNacionais.join(' ou ')} dígitos`
  return `Telefone inválido. Indique o ${rotulos.telemovel.toLowerCase()} com ${digitos}.`
}
