import { describe, expect, it } from 'vitest'
import { montarPrecario } from './precario'
import type { GrupoPrecario } from '@/server/vitrine'

/*
  Importado por caminho relativo, como o teste do `format`: o vitest roda sem
  precisar de saber ler o `paths` do tsconfig. O `@/server/vitrine` aqui é só
  tipo, apagado na compilação — o algoritmo não toca no servidor, que é a razão
  de viver em `lib/` e não em `server/`.

  Isto não é teste de enfeite: a fusão reescreve o preçário que a cliente publica.
  Um erro aqui não parte a página, mostra um preço debaixo do rótulo errado.
*/

let contador = 0

function grupo(nome: string, nota: string | null, itens: [string, number][]): GrupoPrecario {
  contador += 1
  return {
    id: `g${contador}`,
    nome,
    nota,
    itens: itens.map(([servico, preco], i) => ({
      id: `${nome}-${i}`,
      nome: servico,
      descricao: null,
      preco,
      duracaoMin: 30,
    })),
  }
}

const CABELO: [string, number][] = [
  ['Brushing', 1500],
  ['Penteados', 3000],
]

describe('grupos que são a mesma lista', () => {
  it('funde-os numa tabela com uma coluna por grupo', () => {
    const [bloco, ...resto] = montarPrecario([
      grupo('Cabelo curto', 'Sob avaliação.', CABELO),
      grupo('Cabelo comprido', 'Sob avaliação.', [
        ['Brushing', 2000],
        ['Penteados', 4000],
      ]),
    ])

    expect(resto).toHaveLength(0)
    expect(bloco?.nome).toBe('Cabelo')
    expect(bloco?.colunas).toEqual(['Curto', 'Comprido'])
    expect(bloco?.ancora).toBe('preco-cabelo')
    expect(bloco?.nota).toBe('Sob avaliação.')
    /* O "desde" do índice é o mais barato do bloco inteiro, não o da primeira
       coluna: quem lê "desde 15 €" tem de poder pagar 15 €. */
    expect(bloco?.desde).toBe(1500)
    expect(bloco?.linhas.map((l) => l.nome)).toEqual(['Brushing', 'Penteados'])
    expect(bloco?.linhas[0]?.precos).toEqual([
      { rotulo: 'Curto', preco: 1500 },
      { rotulo: 'Comprido', preco: 2000 },
    ])
  })

  it('ignora acentos e caixa, que são duas mãos a escrever o mesmo serviço', () => {
    const blocos = montarPrecario([
      grupo('Cabelo curto', null, [['Botox capilar', 4000]]),
      grupo('Cabelo comprido', null, [['BOTOX CAPILAR', 5000]]),
    ])

    expect(blocos).toHaveLength(1)
    /* O nome que se publica é o do primeiro grupo, não uma versão simplificada:
       a simplificação serve para comparar, nunca para escrever na montra. */
    expect(blocos[0]?.linhas[0]?.nome).toBe('Botox capilar')
  })
})

describe('grupos que não são a mesma lista', () => {
  it('não funde quando falta um serviço de um dos lados', () => {
    const blocos = montarPrecario([
      grupo('Cabelo curto', null, CABELO),
      grupo('Cabelo comprido', null, [['Brushing', 2000]]),
    ])

    expect(blocos.map((b) => b.nome)).toEqual(['Cabelo curto', 'Cabelo comprido'])
    expect(blocos.every((b) => b.colunas.length === 0)).toBe(true)
  })

  it('não funde quando a ordem difere', () => {
    const blocos = montarPrecario([
      grupo('Cabelo curto', null, CABELO),
      grupo('Cabelo comprido', null, [
        ['Penteados', 4000],
        ['Brushing', 2000],
      ]),
    ])

    expect(blocos).toHaveLength(2)
  })

  it('não funde quando as ressalvas se contradizem', () => {
    const blocos = montarPrecario([
      grupo('Cabelo curto', 'Sob avaliação.', CABELO),
      grupo('Cabelo comprido', 'Preço fechado.', CABELO),
    ])

    expect(blocos).toHaveLength(2)
  })

  it('não funde quando os nomes não têm palavra comum, porque não haveria título', () => {
    const blocos = montarPrecario([
      grupo('Corpo', null, CABELO),
      grupo('Rosto', null, CABELO),
    ])

    expect(blocos.map((b) => b.nome)).toEqual(['Corpo', 'Rosto'])
  })

  it('não funde grupos afastados, que reescreveria a ordem do preçário impresso', () => {
    const blocos = montarPrecario([
      grupo('Cabelo curto', null, CABELO),
      grupo('Mãos e Pés', null, [['Manicure', 1200]]),
      grupo('Cabelo comprido', null, CABELO),
    ])

    expect(blocos.map((b) => b.nome)).toEqual(['Cabelo curto', 'Mãos e Pés', 'Cabelo comprido'])
  })
})

describe('grupo sozinho', () => {
  it('mantém-se em lista de uma coluna, com âncora que se lê', () => {
    const [bloco] = montarPrecario([grupo('Mãos e Pés', null, [['Manicure', 1200]])])

    expect(bloco?.colunas).toEqual([])
    expect(bloco?.ancora).toBe('preco-maos-e-pes')
    expect(bloco?.desde).toBe(1200)
    expect(bloco?.linhas[0]?.precos).toEqual([{ rotulo: '', preco: 1200 }])
  })

  it('não deixa um grupo vazio arrastar outro para dentro de si', () => {
    const blocos = montarPrecario([
      grupo('Cabelo curto', null, []),
      grupo('Cabelo comprido', null, []),
    ])

    expect(blocos).toHaveLength(2)
    expect(blocos[0]?.desde).toBe(0)
  })
})
