import { describe, expect, it } from 'vitest'

import { en } from './en'
import { es } from './es'
import { BURACO, interpola, pedacos } from './interpola'
import { pt } from './pt'
import { IDIOMAS, ehIdioma, localeDe, ogLocaleDe } from './tipos'

/*
  O que o compilador já garante, e por isso não se testa aqui: que `en` e `es`
  têm exactamente as chaves de `pt` — o tipo `Dicionario` é `typeof pt`, e uma
  chave a mais ou a menos reprova no typecheck.

  O que ele NÃO garante, e é o que se testa:

  1. Comprimento de arrays. `typeof pt` infere `string[]`, não uma tupla de
     sete — traduzir seis dias de semana compila na mesma e rebenta em runtime
     num `undefined` no meio da frase.
  2. Frases vazias. `''` é uma string válida para o compilador e um buraco
     branco na tela para a cliente.
  3. Buracos. Se o português pede `{hora}` e o inglês pede `{time}`, o
     `interpola` devolve a frase inglesa com o buraco por preencher — sem erro,
     sem aviso, e visível à cliente. Este é o teste que paga a existência do
     ficheiro.
*/

type Plano = Map<string, string>

/** `agendar.horarios.titulo` e `dias.longos[3]` — caminho até cada frase. */
function achatar(valor: unknown, prefixo = '', destino: Plano = new Map()): Plano {
  if (typeof valor === 'string') {
    destino.set(prefixo, valor)
    return destino
  }
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => achatar(item, `${prefixo}[${i}]`, destino))
    return destino
  }
  if (valor !== null && typeof valor === 'object') {
    for (const [chave, dentro] of Object.entries(valor)) {
      achatar(dentro, prefixo ? `${prefixo}.${chave}` : chave, destino)
    }
    return destino
  }
  throw new Error(`Valor que não é frase nem grupo de frases em "${prefixo}".`)
}

function buracos(frase: string): string[] {
  return [...frase.matchAll(BURACO)].map((encontro) => encontro[1]!).sort()
}

const PLANOS = { pt: achatar(pt), en: achatar(en), es: achatar(es) } as const

describe('dicionários', () => {
  it('cobre as três línguas anunciadas', () => {
    expect([...IDIOMAS].sort()).toEqual(Object.keys(PLANOS).sort())
  })

  it.each(['en', 'es'] as const)('%s tem os mesmos caminhos que o pt', (idioma) => {
    // Apanha o que o tipo não apanha: array com menos elementos do que o pt.
    expect([...PLANOS[idioma].keys()].sort()).toEqual([...PLANOS.pt.keys()].sort())
  })

  it.each(['pt', 'en', 'es'] as const)('%s não tem nenhuma frase vazia', (idioma) => {
    const vazias = [...PLANOS[idioma]].filter(([, frase]) => frase.trim() === '')
    expect(vazias.map(([caminho]) => caminho)).toEqual([])
  })

  it.each(['en', 'es'] as const)('%s pede os mesmos buracos que o pt', (idioma) => {
    const divergentes: string[] = []
    for (const [caminho, frasePt] of PLANOS.pt) {
      const frase = PLANOS[idioma].get(caminho)
      if (frase === undefined) continue
      if (buracos(frase).join(',') !== buracos(frasePt).join(',')) divergentes.push(caminho)
    }
    expect(divergentes).toEqual([])
  })

  it.each(['pt', 'en', 'es'] as const)('%s tem sete dias e quatro passos', (idioma) => {
    const dic = { pt, en, es }[idioma]
    expect(dic.dias.longos).toHaveLength(7)
    expect(dic.dias.naFrase).toHaveLength(7)
    expect(dic.agendar.passos).toHaveLength(4)
  })
})

describe('interpola', () => {
  it('preenche os buracos', () => {
    expect(interpola(pt.porta.aberta, { hora: '19:00' })).toBe('Aberto até às 19:00')
  })

  it('aceita números sem os converter à mão', () => {
    expect(interpola(pt.agendar.contador, { passo: 2, total: 4 })).toBe('2 de 4')
  })

  it('apaga o buraco que ninguém preencheu em vez de escrever "undefined"', () => {
    expect(interpola('Abre às {hora}')).toBe('Abre às ')
  })

  it('não toca em texto sem buracos', () => {
    expect(interpola(pt.comum.marcar)).toBe('Marcar')
  })
})

describe('pedacos', () => {
  it('parte a frase entre literais e buracos, pela ordem', () => {
    expect(pedacos('Sinal de {valor} para {loja}.')).toEqual([
      { texto: 'Sinal de ' },
      { buraco: 'valor' },
      { texto: ' para ' },
      { buraco: 'loja' },
      { texto: '.' },
    ])
  })

  it('devolve um pedaço só quando não há buraco nenhum', () => {
    expect(pedacos('Total')).toEqual([{ texto: 'Total' }])
  })

  it('não inventa texto vazio quando o buraco abre a frase', () => {
    expect(pedacos('{nome}, está marcado.')).toEqual([
      { buraco: 'nome' },
      { texto: ', está marcado.' },
    ])
  })
})

describe('eixo da língua', () => {
  it('só aceita as três línguas', () => {
    expect(ehIdioma('pt')).toBe(true)
    expect(ehIdioma('fr')).toBe(false)
    expect(ehIdioma(undefined)).toBe(false)
    expect(ehIdioma(null)).toBe(false)
    // O jsonb do `preferences` devolve o que lá estiver — inclusive isto.
    expect(ehIdioma({ idioma: 'pt' })).toBe(false)
  })

  it('dá a locale da vizinhança, não a do outro lado do oceano', () => {
    expect(localeDe('pt')).toBe('pt-PT')
    expect(localeDe('en')).toBe('en-GB')
    expect(localeDe('es')).toBe('es-ES')
  })

  it('troca o traço pelo sublinhado para o Open Graph', () => {
    expect(ogLocaleDe('pt')).toBe('pt_PT')
  })
})
