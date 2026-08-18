import type { GrupoPrecario } from '@/server/vitrine'

/**
 * Dois blocos do preçário que são a MESMA lista a dois preços passam a ser um.
 *
 * "Cabelo curto" e "Cabelo comprido" trazem os mesmos nove serviços — Brushing,
 * Penteados, Botox capilar, os mesmos nove pela mesma ordem — e só o número
 * muda. Impressos como dois blocos são dezoito linhas em que a cliente lê
 * "Brushing" duas vezes e tem de perceber sozinha que é o mesmo serviço. Numa
 * tabela de duas colunas são nove linhas, e a comparação — que é a pergunta
 * real de quem lê um preçário de cabeleireiro — passa a fazer-se numa linha em
 * vez de a duas páginas de distância.
 *
 * A fusão é geral e não escrita à mão para estas duas categorias: se a dona
 * acrescentar um serviço a um dos lados, as listas deixam de coincidir e os
 * blocos voltam a ser dois, sem ninguém mexer em código. E é ESTRITA de
 * propósito — só funde quando as listas são iguais e pela mesma ordem. Uma
 * sobreposição parcial deixaria buracos na tabela, e um travessão numa coluna
 * de preços não se lê como "não fazemos": lê-se como grátis, ou como erro.
 * Meia tabela é pior do que duas listas honestas.
 */

export interface ColunaDePreco {
  /** O cabeçalho da coluna: "Curto", "Comprido". */
  rotulo: string
  /** Em cêntimos. */
  preco: number
}

export interface LinhaDoPrecario {
  id: string
  nome: string
  /** Uma por coluna, pela ordem das colunas. Nunca vazia, nunca com furos. */
  precos: ColunaDePreco[]
}

export interface BlocoDoPrecario {
  id: string
  /** Destino da âncora do índice. Sai do nome, não do id: `#preco-cabelo` é
   *  um endereço que se lê e se partilha; `#preco-9f3c…` é um uuid na barra. */
  ancora: string
  nome: string
  nota: string | null
  /** O preço mais baixo do bloco, em cêntimos — o "desde" do índice. */
  desde: number
  /** Vazio quando o bloco tem uma coluna de preços só. */
  colunas: string[]
  linhas: LinhaDoPrecario[]
}

/*
  Três colunas é o tecto, e é medida de ecrã e não de gosto: num telemóvel de
  360px sobram 320px depois da margem, e três preços com rótulo ocupam-nos por
  inteiro. A partir daí a tabela deixa de se ler e as listas separadas voltam a
  ser melhores. Com o preçário de hoje a corrida é sempre de duas.
*/
const MAX_COLUNAS = 3

export function montarPrecario(grupos: readonly GrupoPrecario[]): BlocoDoPrecario[] {
  const blocos: BlocoDoPrecario[] = []
  let i = 0

  while (i < grupos.length) {
    const cabeca = grupos[i]
    if (!cabeca) break

    /* Só blocos VIZINHOS se fundem. A ordem vem do preçário impresso, e juntar
       um bloco do topo com outro do fundo da folha reescrevia a sequência que a
       dona mandou imprimir. Cada candidato compara-se com a CABEÇA da corrida e
       não com o anterior — numa tabela de três colunas é o que garante que as
       três são a mesma lista, e não uma corrente onde a primeira e a última já
       divergiram. */
    let fim = i + 1
    while (fim < grupos.length && fim - i < MAX_COLUNAS && mesmaLista(cabeca, grupos[fim])) fim++

    const fundido = fim - i > 1 ? fundir(grupos.slice(i, fim)) : null
    if (fundido) {
      blocos.push(fundido)
      i = fim
    } else {
      blocos.push(sozinho(cabeca))
      i += 1
    }
  }

  return blocos
}

function mesmaLista(a: GrupoPrecario, b: GrupoPrecario | undefined): boolean {
  if (!b || a.itens.length === 0 || a.itens.length !== b.itens.length) return false
  /* Um bloco tem um pé só. Com ressalvas diferentes, escolher uma é apagar a
     outra — e o que se apagava era uma condição de preço. */
  if (a.nota !== null && b.nota !== null && a.nota !== b.nota) return false
  return a.itens.every((item, i) => simplificar(item.nome) === simplificar(b.itens[i]?.nome ?? ''))
}

function fundir(grupos: readonly GrupoPrecario[]): BlocoDoPrecario | null {
  const cabecalho = tituloComum(grupos.map((g) => g.nome))
  const base = grupos[0]
  if (!cabecalho || !base) return null

  /* Os `!` vivem por conta do `mesmaLista`, que já garantiu que todos os grupos
     têm o mesmo número de itens e que há um rótulo por grupo. */
  const linhas: LinhaDoPrecario[] = base.itens.map((item, linha) => ({
    id: item.id,
    nome: item.nome,
    precos: grupos.map((grupo, coluna) => ({
      rotulo: cabecalho.colunas[coluna]!,
      preco: grupo.itens[linha]!.preco,
    })),
  }))

  return {
    id: grupos.map((g) => g.id).join('+'),
    ancora: ancoraDe(cabecalho.titulo),
    nome: cabecalho.titulo,
    nota: grupos.map((g) => g.nota).find((n) => n !== null) ?? null,
    desde: Math.min(...linhas.flatMap((l) => l.precos.map((p) => p.preco))),
    colunas: cabecalho.colunas,
    linhas,
  }
}

function sozinho(grupo: GrupoPrecario): BlocoDoPrecario {
  const precos = grupo.itens.map((i) => i.preco)
  return {
    id: grupo.id,
    ancora: ancoraDe(grupo.nome),
    nome: grupo.nome,
    nota: grupo.nota,
    desde: precos.length > 0 ? Math.min(...precos) : 0,
    colunas: [],
    linhas: grupo.itens.map((item) => ({
      id: item.id,
      nome: item.nome,
      precos: [{ rotulo: '', preco: item.preco }],
    })),
  }
}

/**
 * "Cabelo curto" + "Cabelo comprido" → título "Cabelo", colunas "Curto" e
 * "Comprido".
 *
 * Sem palavra comum não há nome honesto para o bloco fundido, e sem nome não se
 * funde. "Cabelo curto e Cabelo comprido" como título seria pior do que os dois
 * blocos separados, e inventar "Comprimento" seria escrever na montra uma
 * palavra que não está no papel da dona.
 */
function tituloComum(nomes: readonly string[]): { titulo: string; colunas: string[] } | null {
  const partes = nomes.map((n) => n.trim().split(/\s+/))
  const primeiro = partes[0]
  if (partes.length < 2 || !primeiro) return null

  let comum = 0
  while (
    /* O `- 1` dos dois lados: cada nome tem de ficar com pelo menos uma palavra
       para ser o rótulo da sua coluna. Consumir o nome inteiro dava uma coluna
       sem cabeçalho. */
    comum < primeiro.length - 1 &&
    partes.every((p) => p.length > comum + 1 && simplificar(p[comum]) === simplificar(primeiro[comum]))
  ) {
    comum++
  }
  if (comum === 0) return null

  const colunas = partes.map((p) => maiusculaInicial(p.slice(comum).join(' ')))
  /* Dois rótulos iguais seriam duas colunas indistinguíveis. */
  if (new Set(colunas.map(simplificar)).size !== colunas.length) return null

  return { titulo: primeiro.slice(0, comum).join(' '), colunas }
}

/* Sem acentos e sem caixa: "Botox Capilar" e "botox capilar" são o mesmo
   serviço escrito por duas mãos diferentes no formulário do catálogo, e a
   tabela não pode depender de as duas mãos terem concordado. */
function simplificar(texto: string | undefined): string {
  return (texto ?? '')
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function maiusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('pt-PT') + texto.slice(1)
}

function ancoraDe(nome: string): string {
  const limpo = simplificar(nome)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `preco-${limpo}`
}
