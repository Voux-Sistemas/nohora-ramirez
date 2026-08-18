import { describe, expect, it } from 'vitest'
import { decodeCsvBytes, detectSeparator, parseCsv } from './parse.js'

const BOM = '﻿'

describe('detectSeparator', () => {
  it('reconhece o ponto e vírgula do Excel em português', () => {
    expect(detectSeparator('nome;telefone;email\nAna;11999990001;')).toBe(';')
  })

  it('reconhece a vírgula', () => {
    expect(detectSeparator('nome,telefone,email\nAna,11999990001,')).toBe(',')
  })

  it('reconhece a tabulação de quem colou direto da planilha', () => {
    expect(detectSeparator('nome\ttelefone\nAna\t11999990001')).toBe('\t')
  })

  it('não se perde com vírgula dentro de campo entre aspas', () => {
    expect(detectSeparator('"nome, completo";telefone\n"Ana Souza";11999990001')).toBe(';')
  })

  it('olha só o cabeçalho, não o corpo', () => {
    // O corpo tem vírgulas de endereço; o cabeçalho é ponto e vírgula.
    const texto = 'nome;telefone\nAna;11999990001\nRua X, 100, Centro;11999990002'
    expect(detectSeparator(texto)).toBe(';')
  })

  it('coluna única cai na vírgula sem quebrar', () => {
    expect(detectSeparator('telefone\n11999990001')).toBe(',')
  })

  it('detecta mesmo com BOM na frente', () => {
    expect(detectSeparator(`${BOM}nome;telefone`)).toBe(';')
  })
})

describe('parseCsv', () => {
  it('lê o arquivo do Excel pt-BR: BOM, ponto e vírgula e CRLF', () => {
    const texto = `${BOM}nome;telefone;email\r\nAna Souza;(11) 99999-0001;ana@exemplo.com\r\n`

    expect(parseCsv(texto)).toEqual([
      ['nome', 'telefone', 'email'],
      ['Ana Souza', '(11) 99999-0001', 'ana@exemplo.com'],
    ])
  })

  it('devolve o cabeçalho sem o BOM grudado na primeira coluna', () => {
    // Este é o defeito que recusava um arquivo perfeito: "﻿nome" nunca
    // casa com "nome", e o import dizia que faltava a coluna que estava lá.
    const [cabecalho] = parseCsv(`${BOM}nome,telefone\nAna,11999990001`)
    expect(cabecalho?.[0]).toBe('nome')
  })

  it('continua lendo vírgula como antes', () => {
    expect(parseCsv('nome,telefone\nAna,11999990001')).toEqual([
      ['nome', 'telefone'],
      ['Ana', '11999990001'],
    ])
  })

  it('respeita aspas em volta de campo com o separador dentro', () => {
    const texto = 'nome;endereco\nAna;"Rua Exemplo, 100; fundos"'
    expect(parseCsv(texto)).toEqual([
      ['nome', 'endereco'],
      ['Ana', 'Rua Exemplo, 100; fundos'],
    ])
  })

  it('entende aspas duplicadas como aspa literal', () => {
    expect(parseCsv('nome\n"Ana ""Aninha"" Souza"')).toEqual([['nome'], ['Ana "Aninha" Souza']])
  })

  it('aceita quebra de linha dentro de campo entre aspas', () => {
    const texto = 'nome;obs\nAna;"linha um\nlinha dois"'
    expect(parseCsv(texto)).toEqual([
      ['nome', 'obs'],
      ['Ana', 'linha um\nlinha dois'],
    ])
  })

  it('descarta a linha vazia que a planilha deixa no fim', () => {
    expect(parseCsv('nome;telefone\nAna;11999990001\n;\n\n')).toEqual([
      ['nome', 'telefone'],
      ['Ana', '11999990001'],
    ])
  })

  it('preserva célula vazia no meio da linha', () => {
    expect(parseCsv('nome;telefone;email\nAna;11999990001;')).toEqual([
      ['nome', 'telefone', 'email'],
      ['Ana', '11999990001', ''],
    ])
  })

  it('aceita o separador imposto de fora', () => {
    // Cabeçalho de coluna única, corpo com ponto e vírgula: a detecção não tem
    // como adivinhar, mas quem chama pode saber.
    expect(parseCsv('telefone\n11999990001;lixo', ';')).toEqual([
      ['telefone'],
      ['11999990001', 'lixo'],
    ])
  })

  it('arquivo vazio devolve nada em vez de quebrar', () => {
    expect(parseCsv('')).toEqual([])
    expect(parseCsv(BOM)).toEqual([])
  })
})

/*
 * Aqui o assunto são bytes, não texto: escrever a fixture como string faria o
 * ficheiro de teste passar a ser UTF-8 antes de a função a ver, e o defeito
 * que se quer apanhar desapareceria antes de começar.
 */
describe('decodeCsvBytes', () => {
  const bytes = (...n: number[]) => new Uint8Array(n)

  it('lê o CSV do Excel português, que é Windows-1252', () => {
    // "M" "á" "r" "c" "i" "a" — o á é o byte E1, sozinho.
    expect(decodeCsvBytes(bytes(0x4d, 0xe1, 0x72, 0x63, 0x69, 0x61))).toBe('Márcia')
  })

  it('lê o mesmo nome gravado em UTF-8', () => {
    expect(decodeCsvBytes(bytes(0x4d, 0xc3, 0xa1, 0x72, 0x63, 0x69, 0x61))).toBe('Márcia')
  })

  it('lê o "CSV UTF-8" do Excel, e come o BOM pelo caminho', () => {
    const comBom = bytes(0xef, 0xbb, 0xbf, 0x4d, 0xc3, 0xa1, 0x72, 0x63, 0x69, 0x61)
    expect(decodeCsvBytes(comBom)).toBe('Márcia')
    expect(decodeCsvBytes(comBom).startsWith(BOM)).toBe(false)
  })

  it('não inventa caractere de substituição em nenhum dos dois caminhos', () => {
    // É este o sintoma que chegou da reunião: o nome sai da base estragado e
    // vai estragado dentro da mensagem para a cliente.
    expect(decodeCsvBytes(bytes(0x4a, 0x6f, 0xe3, 0x6f))).not.toContain('�')
    expect(decodeCsvBytes(bytes(0x4a, 0x6f, 0xe3, 0x6f))).toBe('João')
  })

  it('ficheiro só de ASCII lê igual nos dois lados', () => {
    expect(decodeCsvBytes(bytes(0x6e, 0x6f, 0x6d, 0x65, 0x3b, 0x74, 0x65, 0x6c))).toBe('nome;tel')
  })

  it('ficheiro vazio devolve texto vazio', () => {
    expect(decodeCsvBytes(bytes())).toBe('')
  })
})
