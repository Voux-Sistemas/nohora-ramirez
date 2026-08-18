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

/**
 * Bytes do ficheiro → texto, adivinhando a codificação.
 *
 * O `File.text()` do navegador e do servidor decide sozinho: é sempre UTF-8. E
 * o Excel em português, no Windows, guarda "CSV (separado por vírgulas)" em
 * Windows-1252 — a codificação de um byte por letra que a máquina usa desde
 * antes de o UTF-8 existir. Os dois juntos dão o defeito que ninguém liga ao
 * ficheiro: "Márcia" entra na base como "M?rcia", com o caractere de
 * substituição no meio, e sai de lá semanas depois dentro da mensagem que o
 * salão manda à cliente. O nome dela chega estragado ao telemóvel dela.
 *
 * A ordem da adivinha é a única que não erra:
 *
 * 1. **BOM é resposta, não pista.** O Excel só o escreve quando gravou em
 *    UTF-8 ("CSV UTF-8"), e ninguém mais o escreve por engano.
 * 2. **UTF-8 estrito.** Sem BOM, tenta-se UTF-8 a recusar byte inválido. Texto
 *    só de ASCII passa (é UTF-8 válido, e em Windows-1252 daria o mesmo), e
 *    UTF-8 verdadeiro passa.
 * 3. **Windows-1252 no resto.** Um `á` gravado em Windows-1252 é o byte E1,
 *    que não é sequência UTF-8 válida — o passo 2 recusa-o, e aqui ele volta a
 *    ser `á`. Não existe ficheiro que engane os dois passos: as sequências
 *    UTF-8 válidas com acento não são texto plausível em Windows-1252.
 *
 * O BOM não sobrevive a nenhum dos três caminhos: o `TextDecoder` come-o por
 * omissão. `parseCsv` continua a tirá-lo à mesma, porque também é chamado com
 * texto que não passou por aqui.
 */
export function decodeCsvBytes(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8')
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return utf8.decode(bytes)

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
