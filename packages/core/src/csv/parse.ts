/**
 * Leitura de CSV vindo de planilha.
 *
 * O arquivo que chega aqui não foi gerado por programa nenhum: é uma planilha
 * que a recepção preencheu e salvou como CSV. Isso muda duas coisas em relação
 * a um CSV de sistema, e as duas quebram o parser ingênuo:
 *
 * 1. **O separador não é vírgula.** O Excel em português salva com ponto e
 *    vírgula, porque a vírgula já é o separador decimal. Quem preenche não
 *    escolhe isso e nem fica sabendo — é o padrão da máquina dela. Por isso o
 *    separador é detectado do próprio arquivo, não exigido de quem envia.
 * 2. **O Excel escreve BOM.** Três bytes invisíveis no começo do arquivo. Sem
 *    remover, a primeira coluna do cabeçalho chega como "﻿nome" e nunca
 *    casa com "nome" — o import recusa um arquivo que está perfeito, dizendo
 *    que falta a coluna que está ali na frente de todo mundo.
 *
 * Nenhum dos dois dá erro parcial. Os dois recusam o arquivo inteiro, com uma
 * mensagem que aponta para o lugar errado.
 */

/** Separadores que uma planilha realmente produz. */
const SEPARADORES = [',', ';', '\t'] as const

export type CsvSeparator = (typeof SEPARADORES)[number]

/** Byte order mark: invisível no editor, fatal na comparação de string. */
const BOM = '﻿'

/**
 * Descobre o separador olhando só a primeira linha.
 *
 * O cabeçalho é a linha mais confiável do arquivo: são nomes de coluna, sem
 * dinheiro, sem endereço, sem texto livre — ou seja, sem os casos em que uma
 * vírgula aparece dentro do campo e confunde a contagem.
 */
export function detectSeparator(text: string): CsvSeparator {
  const cabecalho = primeiraLinha(text.startsWith(BOM) ? text.slice(BOM.length) : text)

  let escolhido: CsvSeparator = ','
  let maior = 0
  for (const separador of SEPARADORES) {
    const quantos = contarForaDeAspas(cabecalho, separador)
    if (quantos > maior) {
      maior = quantos
      escolhido = separador
    }
  }
  // Coluna única (ou arquivo vazio): não há o que detectar, e vírgula não faz mal.
  return escolhido
}

/**
 * CSV → matriz de células. Aspas duplas protegem separador e quebra de linha
 * dentro do campo; `""` é uma aspa literal.
 *
 * Linhas totalmente vazias são descartadas — planilha quase sempre traz uma no
 * fim, e ela viraria um cliente sem nome nem telefone.
 */
export function parseCsv(text: string, separator?: CsvSeparator): string[][] {
  const limpo = text.startsWith(BOM) ? text.slice(BOM.length) : text
  const sep = separator ?? detectSeparator(limpo)

  const linhas: string[][] = []
  let linha: string[] = []
  let campo = ''
  let dentroDeAspas = false

  const fecharLinha = (): void => {
    linha.push(campo)
    campo = ''
    if (linha.some((celula) => celula.trim() !== '')) linhas.push(linha)
    linha = []
  }

  for (let i = 0; i < limpo.length; i += 1) {
    const char = limpo[i]

    if (dentroDeAspas) {
      if (char === '"' && limpo[i + 1] === '"') {
        campo += '"'
        i += 1
      } else if (char === '"') {
        dentroDeAspas = false
      } else {
        campo += char
      }
      continue
    }

    if (char === '"') {
      dentroDeAspas = true
    } else if (char === sep) {
      linha.push(campo)
      campo = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && limpo[i + 1] === '\n') i += 1
      fecharLinha()
    } else {
      campo += char
    }
  }

  if (campo !== '' || linha.length > 0) fecharLinha()

  return linhas
}

function primeiraLinha(text: string): string {
  let dentroDeAspas = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (char === '"') {
      dentroDeAspas = !dentroDeAspas
    } else if (!dentroDeAspas && (char === '\n' || char === '\r')) {
      return text.slice(0, i)
    }
  }
  return text
}

function contarForaDeAspas(linha: string, separador: string): number {
  let total = 0
  let dentroDeAspas = false
  for (const char of linha) {
    if (char === '"') dentroDeAspas = !dentroDeAspas
    else if (char === separador && !dentroDeAspas) total += 1
  }
  return total
}
