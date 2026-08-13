/**
 * Em que país este salão opera.
 *
 * Existe porque o sistema é produto: o primeiro cliente é português, o próximo
 * pode ser brasileiro, e a diferença entre os dois não pode estar espalhada por
 * quarenta arquivos. Moeda, formato de telemóvel, locale e fuso padrão saem
 * todos daqui.
 *
 * O que motivou juntar isto num lugar só foi um bug que não dava erro nenhum:
 * `toE164` exigia 10 ou 11 dígitos porque número brasileiro tem esse tamanho.
 * Telemóvel português tem 9. Toda cliente portuguesa era recusada no formulário
 * de marcação — e a mensagem dizia "telefone inválido", que é exatamente o que
 * o código achava que estava a acontecer.
 *
 * Trocar de país é trocar `PAIS` no ambiente. Não é multi-tenant: um processo
 * serve um país. Uma rede com lojas em dois países precisaria disto por
 * unidade, e aí a decisão muda de lugar — mas nenhum cliente pediu isso, e
 * inventar o eixo agora custaria em toda leitura de preço do sistema.
 */

export interface Pais {
  codigo: 'PT' | 'BR'
  /** Locale de formatação — decide separador decimal, nome de mês, ordem da data. */
  locale: string
  /** ISO 4217. */
  moeda: string
  /** Indicativo internacional, sem o `+`. */
  ddi: string
  /** Fuso sugerido ao cadastrar uma unidade nova. A unidade pode ter o seu. */
  fusoPadrao: string
  /** Comprimentos aceitos do número nacional, sem indicativo. */
  digitosNacionais: readonly number[]
  /** Como a recepção escreve o número num papel. */
  formatarNacional: (nacional: string) => string
  /**
   * As palavras de endereço, que não são traduzíveis uma a uma: Portugal tem
   * distrito e freguesia onde o Brasil tem estado e bairro, e a sigla de duas
   * letras da UF não existe cá. Um formulário que pede "CEP" a uma cliente em
   * Valongo é um formulário que ela não sabe se deve preencher.
   */
  rotulos: {
    regiao: string
    subdivisao: string
    codigoPostal: string
    telemovel: string
  }
  /** Comprimento máximo do campo de região — a UF brasileira tem 2. */
  maxRegiao?: number
  exemploCodigoPostal: string
}

const PORTUGAL: Pais = {
  codigo: 'PT',
  locale: 'pt-PT',
  moeda: 'EUR',
  ddi: '351',
  fusoPadrao: 'Europe/Lisbon',
  /* Nove dígitos, sempre: telemóvel abre por 9, fixo por 2. Não há tronco
     nacional a remover — o "0" de discagem interurbana não existe cá. */
  digitosNacionais: [9],
  formatarNacional: (n) => `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`,
  rotulos: {
    regiao: 'Distrito',
    subdivisao: 'Freguesia',
    codigoPostal: 'Código postal',
    telemovel: 'Telemóvel',
  },
  exemploCodigoPostal: '4440-000',
}

const BRASIL: Pais = {
  codigo: 'BR',
  locale: 'pt-BR',
  moeda: 'BRL',
  ddi: '55',
  fusoPadrao: 'America/Sao_Paulo',
  /* 11 com o nono dígito do celular, 10 no fixo e nos celulares antigos. */
  digitosNacionais: [10, 11],
  formatarNacional: (n) =>
    n.length === 11
      ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`
      : `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`,
  rotulos: {
    regiao: 'Estado (UF)',
    subdivisao: 'Bairro',
    codigoPostal: 'CEP',
    telemovel: 'Celular',
  },
  maxRegiao: 2,
  exemploCodigoPostal: '01042-001',
}

const PAISES: Record<string, Pais> = { PT: PORTUGAL, BR: BRASIL }

/**
 * O padrão é Portugal porque é onde o sistema está em produção hoje.
 *
 * Um código desconhecido cai no padrão em vez de derrubar o processo: o preço
 * de subir com o país errado é um símbolo de moeda torto numa tela; o de não
 * subir é o salão sem agenda numa manhã de sábado.
 */
export function pais(): Pais {
  return PAISES[process.env.PAIS?.toUpperCase() ?? ''] ?? PORTUGAL
}
